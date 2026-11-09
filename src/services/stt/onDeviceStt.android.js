import { File, Paths } from "expo-file-system";
import { initWhisper } from "whisper.rn";

const MODEL_NAME = "ggml-tiny.en-q5_1.bin";
const MINIMUM_MODEL_BYTES = 30_000_000;
const MODEL_URL =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en-q5_1.bin?download=true";
const MODEL_ID = "whisper.cpp/ggml-tiny.en-q5_1";
const MODEL_FILE = new File(Paths.document, MODEL_NAME);

export const onDeviceStt = {
  model: { id: MODEL_ID, name: "Whisper tiny.en (Q5_1)" },
  capabilities: {
    microphone: true,
    audioFile: true,
    processingLocation: "on-device",
    unavailableReason: null,
  },

  async getModelStatus() {
    if (MODEL_FILE.exists && MODEL_FILE.size >= MINIMUM_MODEL_BYTES) {
      return { status: "ready", uri: MODEL_FILE.uri };
    }
    return { status: "missing", uri: null };
  },

  async downloadModel({ onProgress, signal } = {}) {
    if (MODEL_FILE.exists) MODEL_FILE.delete();
    if (signal?.aborted) throw makeAbortError();

    const task = File.createDownloadTask(MODEL_URL, MODEL_FILE, {
      onProgress: ({ bytesWritten, totalBytes }) => {
        // Native Android progress events can provide BigInt byte counts.
        const written = Number(bytesWritten);
        const total = Number(totalBytes);
        onProgress?.(
          total > 0 ? Math.min(1, written / total) : null,
        );
      },
    });
    const cancelDownload = () => task.cancel();
    signal?.addEventListener("abort", cancelDownload, { once: true });

    try {
      const downloadedFile = await task.downloadAsync();
      if (signal?.aborted) throw makeAbortError();
      if (!downloadedFile?.exists || downloadedFile.size < MINIMUM_MODEL_BYTES) {
        throw new Error("The Whisper model download did not produce a usable file.");
      }
      return { uri: downloadedFile.uri, size: downloadedFile.size };
    } catch (error) {
      if (MODEL_FILE.exists) MODEL_FILE.delete();
      throw error;
    } finally {
      signal?.removeEventListener("abort", cancelDownload);
      task.release();
    }
  },

  async transcribeFile({ uri, signal, onProgress }) {
    if (signal?.aborted) throw makeAbortError();
    if (!MODEL_FILE.exists || MODEL_FILE.size === 0) {
      throw new Error("Download the local Whisper model before transcribing.");
    }

    let context;
    let transcription;
    let abortRequested = false;
    const abortTranscription = () => {
      abortRequested = true;
      transcription?.stop();
    };

    signal?.addEventListener("abort", abortTranscription, { once: true });

    try {
      context = await initWhisper({
        filePath: MODEL_FILE.uri,
        useGpu: true,
        useCoreMLIos: false,
      });

      if (signal?.aborted) throw makeAbortError();

      transcription = context.transcribe(uri, {
        language: "en",
        onProgress,
      });

      const result = await transcription.promise;
      if (abortRequested || result.isAborted) throw makeAbortError();

      return {
        transcript: result.result || "",
        model: MODEL_ID,
        language: result.language || "en",
        responseDetails: {
          text: result.result || "",
          language: result.language || null,
          segments: (result.segments || []).map((segment) => ({
            text: segment.text,
            startSecond: segment.t0,
            endSecond: segment.t1,
          })),
        },
      };
    } finally {
      signal?.removeEventListener("abort", abortTranscription);
      if (context) await context.release();
    }
  },
};

function makeAbortError() {
  const error = new Error("Transcription canceled.");
  error.name = "AbortError";
  return error;
}
