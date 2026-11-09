import { AudioModule, setAudioModeAsync, useAudioStream } from "expo-audio";
import { File } from "expo-file-system";
import { useFocusEffect } from "expo-router";
import { nanoid } from "@reduxjs/toolkit";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { getAudioFileMetadata, claimMicrophone, safeErrorMessage } from "../services/audio/recording";
import { sttAdapters } from "../services/stt";
import { sttResponseReceived } from "../store/sttLogsSlice";

const REQUEST_TIMEOUT_MS = 90_000;

export function useMicrophoneTranscription({ engine, model }) {
  const dispatch = useDispatch();
  const { stream } = useAudioStream({
    sampleRate: 16_000,
    channels: 1,
    encoding: "int16",
  });
  const ownerRef = useRef(Symbol(engine));
  const releaseMicrophoneRef = useRef(null);
  const recordingUriRef = useRef(null);
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(null);
  const requestedModelRef = useRef(null);
  const transcriptionStartedRef = useRef(false);
  const requestTimedOutRef = useRef(false);
  const timeoutRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(null);
  const [durationMs, setDurationMs] = useState(0);
  const [recordingFormat, setRecordingFormat] = useState(null);
  const recordingStartedAtRef = useRef(null);

  useEffect(() => {
    if (status !== "recording") return undefined;
    const timer = setInterval(() => {
      setDurationMs(Date.now() - recordingStartedAtRef.current);
    }, 250);
    return () => clearInterval(timer);
  }, [status]);

  const releaseAudio = useCallback(
    async (deleteRecording) => {
      try {
        stream.stop();
      } catch (_error) {
        // The stream may already have stopped during a permission or platform error.
      }

      const uri = recordingUriRef.current;
      recordingUriRef.current = null;
      if (deleteRecording && uri) {
        try {
          const file = new File(uri);
          if (file.exists) file.delete();
        } catch (_error) {
          // Temporary recordings are best-effort cleanup after cancellation.
        }
      }

      releaseMicrophoneRef.current?.();
      releaseMicrophoneRef.current = null;
    },
    [stream],
  );

  const cancel = useCallback(async () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    if (!transcriptionStartedRef.current) await releaseAudio(true);
    setStatus("idle");
  }, [releaseAudio]);

  useFocusEffect(
    useCallback(() => () => {
      void cancel();
    }, [cancel]),
  );

  const startRecording = useCallback(async () => {
    if (status === "recording" || status === "processing") return;

    setError("");
    setResult(null);
    setProgress(null);
    setDurationMs(0);
    setRecordingFormat(null);

    const setupController = new AbortController();
    abortControllerRef.current = setupController;
    requestTimedOutRef.current = false;
    try {
      releaseMicrophoneRef.current = claimMicrophone(ownerRef.current);
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (setupController.signal.aborted) throw makeAbortError();
      if (!permission.granted) {
        throw new Error("Microphone permission was denied.");
      }

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (setupController.signal.aborted) throw makeAbortError();
      await stream.start();
      if (setupController.signal.aborted) throw makeAbortError();
      const recording = await stream.startFileRecordingAsync({ format: "wav" });
      recordingUriRef.current = recording.uri;
      if (setupController.signal.aborted) throw makeAbortError();
      recordingStartedAtRef.current = Date.now();
      requestIdRef.current = nanoid();
      requestedModelRef.current = model;
      setStatus("recording");
      return { requestId: requestIdRef.current, requestedModel: model };
    } catch (caughtError) {
      await releaseAudio(true);
      abortControllerRef.current = null;
      if (setupController.signal.aborted || caughtError?.name === "AbortError") {
        setStatus("idle");
        return null;
      }
      const requestId = nanoid();
      requestIdRef.current = null;
      requestedModelRef.current = null;
      const message = safeErrorMessage(caughtError, "Could not start microphone recording.");
      setError(message);
      setStatus("error");
      const entry = {
        id: nanoid(),
        requestId,
        createdAt: new Date().toISOString(),
        engine,
        model: model || null,
        source: "microphone",
        status: "error",
        transcript: "",
        errorMessage: message,
        durationMs: 0,
      };
      setResult(entry);
      dispatch(sttResponseReceived(entry));
      return null;
    }
  }, [dispatch, engine, model, releaseAudio, status, stream]);

  const stopAndTranscribe = useCallback(async () => {
    if (status !== "recording") return;

    const requestId = requestIdRef.current || nanoid();
    const requestedModel = requestedModelRef.current;
    const startedAt = recordingStartedAtRef.current || Date.now();
    transcriptionStartedRef.current = true;
    setStatus("processing");
    setError("");

    let recording;
    try {
      recording = await stream.stopFileRecordingAsync();
      recordingUriRef.current = recording.uri;
      stream.stop();
      setDurationMs(recording.duration * 1000 || Date.now() - startedAt);
      setRecordingFormat({
        sampleRate: recording.sampleRate,
        channels: recording.channels,
        encoding: recording.encoding,
      });

      const adapter = sttAdapters[engine];
      if (abortControllerRef.current?.signal.aborted) throw makeAbortError();
      if (!adapter?.capabilities.microphone) {
        throw new Error(adapter?.capabilities.unavailableReason || "This engine cannot transcribe microphone audio.");
      }

      const controller = abortControllerRef.current || new AbortController();
      abortControllerRef.current = controller;
      requestTimedOutRef.current = false;
      timeoutRef.current = setTimeout(() => {
        requestTimedOutRef.current = true;
        controller.abort();
      }, REQUEST_TIMEOUT_MS);
      const fileMetadata = getAudioFileMetadata(recording.uri);
      const adapterProgress = engine === "phone-ai"
        ? (value) => setProgress(typeof value === "number" ? value : null)
        : undefined;
      const processingStartedAt = Date.now();

      const response = await adapter.transcribeFile({
          uri: recording.uri,
          filename: fileMetadata.filename,
          mimeType: fileMetadata.mimeType,
          language: "en-US",
          model: requestedModel || adapter.model?.id,
          signal: controller.signal,
          onProgress: adapterProgress,
      });

        const entry = {
          id: nanoid(),
          requestId,
          createdAt: new Date().toISOString(),
          engine,
          model: response.model || requestedModel || adapter.model?.id || null,
          returnedModel: response.returnedModel || null,
          source: "microphone",
          filename: fileMetadata.filename,
          status: "success",
          transcript: response.transcript || "",
          durationMs: Date.now() - processingStartedAt,
          language: response.language || null,
          responseDetails: response.responseDetails || { text: response.transcript || "" },
        };

      setResult(entry);
      setStatus("success");
      dispatch(sttResponseReceived(entry));
    } catch (caughtError) {
      const controller = abortControllerRef.current;
      const canceled = !requestTimedOutRef.current &&
        (controller?.signal.aborted || caughtError?.name === "AbortError");
      if (canceled) {
        setStatus("idle");
        return;
      }

      const message = requestTimedOutRef.current
        ? "Transcription timed out after 90 seconds."
        : safeErrorMessage(caughtError);
      const adapter = sttAdapters[engine];
      const entry = {
        id: nanoid(),
        requestId,
        createdAt: new Date().toISOString(),
        engine,
        model: requestedModel || adapter?.model?.id || null,
        source: "microphone",
        filename: recording?.uri ? getAudioFileMetadata(recording.uri).filename : null,
        status: "error",
        transcript: "",
        errorMessage: message,
        durationMs: Date.now() - startedAt,
      };
      setError(message);
      setResult(entry);
      setStatus("error");
      dispatch(sttResponseReceived(entry));
    } finally {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      transcriptionStartedRef.current = false;
      abortControllerRef.current = null;
      requestIdRef.current = null;
      requestedModelRef.current = null;
      setProgress(null);
      await releaseAudio(true);
    }
  }, [dispatch, engine, releaseAudio, status, stream]);

  return {
    status,
    error,
    result,
    progress,
    durationMs,
    recordingFormat,
    startRecording,
    stopAndTranscribe,
    cancel,
  };
}

function makeAbortError() {
  const error = new Error("Recording canceled.");
  error.name = "AbortError";
  return error;
}
