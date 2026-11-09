import { Platform } from "react-native";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import { claimMicrophone } from "../audio/recording";

const androidVersion = typeof Platform.Version === "number" ? Platform.Version : Number.parseInt(String(Platform.Version), 10);
const supportsNativeFileTranscription = androidVersion >= 33;
const fileUnavailableReason =
  "Phone-native WAV transcription requires Android 13 or later in the installed speech-recognition library.";

let activeSession = null;

function clearSession(session) {
  if (!session || activeSession !== session) return;
  session.subscriptions.forEach((subscription) => subscription.remove());
  session.releaseMicrophone?.();
  activeSession = null;
}

function makeAbortError() {
  const error = new Error("Transcription canceled.");
  error.name = "AbortError";
  return error;
}

export const nativeStt = {
  capabilities: {
    microphone: true,
    audioFile: supportsNativeFileTranscription,
    processingLocation: "system-service",
    unavailableReason: null,
    audioFileUnavailableReason: supportsNativeFileTranscription ? null : fileUnavailableReason,
  },

  async getAvailability() {
    const available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
    const permission = await ExpoSpeechRecognitionModule.getPermissionsAsync();
    return {
      available,
      permissionGranted: permission.granted,
      message: available
        ? permission.granted
          ? "Speech recognition is available."
          : "Microphone permission will be requested when listening starts."
        : "The phone's speech-recognition service is unavailable.",
    };
  },

  async startListening({ onPartial, onFinal, onError, onEnd }) {
    if (activeSession) {
      throw new Error("A phone-native listening session is already active.");
    }

    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      throw new Error("The phone's speech-recognition service is unavailable.");
    }

    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      throw new Error("Microphone permission was denied.");
    }

    const session = {
      subscriptions: [],
      releaseMicrophone: claimMicrophone("phone-native"),
      lastFinalText: null,
      ended: false,
    };
    activeSession = session;

    session.subscriptions.push(
      ExpoSpeechRecognitionModule.addListener("result", (event) => {
        const text = event.results?.[0]?.transcript?.trim() || "";
        if (!event.isFinal) {
          session.lastFinalText = null;
          if (text) onPartial(text);
          return;
        }

        if (!text || session.lastFinalText === text) return;
        session.lastFinalText = text;
        onFinal({
          transcript: text,
          language: "en",
          responseDetails: { text, isFinal: true },
        });
      }),
      ExpoSpeechRecognitionModule.addListener("speechstart", () => {
        session.lastFinalText = null;
      }),
      ExpoSpeechRecognitionModule.addListener("error", (event) => {
        if (event.error === "aborted") return;
        onError(new Error(event.message || `Speech recognition error: ${event.error}.`));
      }),
      ExpoSpeechRecognitionModule.addListener("end", () => {
        if (session.ended) return;
        session.ended = true;
        clearSession(session);
        onEnd();
      }),
    );

    try {
      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
        continuous: true,
        addsPunctuation: true,
        // OS speech services may process audio on-device or remotely.
        requiresOnDeviceRecognition: false,
      });
    } catch (error) {
      clearSession(session);
      throw error;
    }
  },

  async stopListening() {
    if (activeSession) ExpoSpeechRecognitionModule.stop();
  },

  async cancelListening() {
    const session = activeSession;
    if (!session) return;
    try {
      ExpoSpeechRecognitionModule.abort();
    } finally {
      clearSession(session);
    }
  },

  async transcribeFile({ uri, language = "en-US", signal }) {
    if (!supportsNativeFileTranscription) {
      throw new Error(fileUnavailableReason);
    }
    if (!uri) throw new Error("A local audio file URI is required.");
    if (signal?.aborted) throw makeAbortError();
    if (activeSession) {
      throw new Error("A phone-native recognition session is already active.");
    }

    const session = {
      subscriptions: [],
      releaseMicrophone: null,
      lastFinalText: null,
      ended: false,
    };
    activeSession = session;

    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (signal?.aborted) throw makeAbortError();
      if (!permission.granted) {
        throw new Error("Microphone permission was denied.");
      }
    } catch (error) {
      clearSession(session);
      throw error;
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      let transcript = "";

      const finish = (error) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener("abort", abort);
        clearSession(session);
        if (error) reject(error);
        else {
          resolve({
            transcript,
            model: null,
            language: language.split("-")[0] || null,
            responseDetails: { text: transcript },
          });
        }
      };

      const abort = () => {
        ExpoSpeechRecognitionModule.abort();
        finish(makeAbortError());
      };

      session.subscriptions.push(
        ExpoSpeechRecognitionModule.addListener("result", (event) => {
          if (!event.isFinal) return;
          const finalText = event.results?.[0]?.transcript?.trim() || "";
          if (finalText && finalText !== session.lastFinalText) {
            transcript = finalText;
            session.lastFinalText = finalText;
          }
        }),
        ExpoSpeechRecognitionModule.addListener("error", (event) => {
          if (event.error === "aborted" && signal?.aborted) return;
          if (event.error === "aborted") return;
          finish(new Error(event.message || `Speech recognition error: ${event.error}.`));
        }),
        ExpoSpeechRecognitionModule.addListener("end", () => finish()),
      );

      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) {
        abort();
        return;
      }

      try {
        ExpoSpeechRecognitionModule.start({
          lang: language,
          interimResults: false,
          continuous: false,
          requiresOnDeviceRecognition: false,
          audioSource: { uri },
        });
      } catch (error) {
        finish(error);
      }
    });
  },
};
