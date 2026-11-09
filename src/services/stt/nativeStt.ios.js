import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import { AppState, Platform } from "react-native";
import { claimMicrophone } from "../audio/recording";
const majorVersion = Number.parseInt(String(Platform.Version), 10);
const supportsNativeFileTranscription = majorVersion >= 17;
const nativeFileUnavailableReason =
  "Phone-native file transcription requires iOS 17 or later in the installed speech-recognition library.";

let activeSession = null;
const FOREGROUND_TIMEOUT_MS = 5_000;

function makeStartupAbortError() {
  const error = new Error("Listening startup canceled.");
  error.name = "AbortError";
  return error;
}

function waitForForeground(signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(makeStartupAbortError());
      return;
    }

    let frame = null;
    const finish = (error) => {
      clearTimeout(timeout);
      if (frame !== null) cancelAnimationFrame(frame);
      subscription.remove();
      signal.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve();
    };
    const onAbort = () => finish(makeStartupAbortError());
    const checkState = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      if (AppState.currentState !== "active") return;
      // Let the permission-dialog lifecycle events settle before taking the audio session.
      frame = requestAnimationFrame(() => {
        frame = null;
        if (AppState.currentState === "active") finish();
      });
    };
    const subscription = AppState.addEventListener("change", checkState);
    const timeout = setTimeout(() => {
      finish(new Error("The app did not return to the foreground. Please try listening again."));
    }, FOREGROUND_TIMEOUT_MS);
    signal.addEventListener("abort", onAbort);
    checkState();
  });
}

function clearSession(session) {
  if (!session || activeSession !== session) return;
  session.startupController.abort();
  session.subscriptions.forEach((subscription) => subscription.remove());
  session.releaseMicrophone?.();
  activeSession = null;
}

export const nativeStt = {
  capabilities: {
    microphone: true,
    audioFile: supportsNativeFileTranscription,
    processingLocation: "system-service",
    unavailableReason: null,
    audioFileUnavailableReason: supportsNativeFileTranscription
      ? null
      : nativeFileUnavailableReason,
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
          : "Microphone and speech-recognition permission will be requested when listening starts."
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

    const session = {
      subscriptions: [],
      startupController: new AbortController(),
      started: false,
      releaseMicrophone: null,
      lastFinalText: null,
      ended: false,
    };
    activeSession = session;

    try {
      const signal = session.startupController.signal;
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (signal.aborted) throw makeStartupAbortError();
      if (!permission.granted) {
        throw new Error("Microphone or speech-recognition permission was denied.");
      }

      await waitForForeground(signal);
      if (signal.aborted) throw makeStartupAbortError();
      session.releaseMicrophone = claimMicrophone("phone-native");

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

      session.started = true;
      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
        continuous: true,
        addsPunctuation: true,
        iosTaskHint: "dictation",
        // OS speech services may process audio on-device or remotely.
        requiresOnDeviceRecognition: false,
      });
    } catch (error) {
      clearSession(session);
      throw error;
    }
  },

  async stopListening() {
    if (activeSession?.started) ExpoSpeechRecognitionModule.stop();
  },

  async cancelListening() {
    const session = activeSession;
    if (!session) return;
    try {
      if (session.started) ExpoSpeechRecognitionModule.abort();
    } finally {
      clearSession(session);
    }
  },

  async transcribeFile({ uri, language = "en-US", signal }) {
    if (!supportsNativeFileTranscription) {
      throw new Error(nativeFileUnavailableReason);
    }
    if (!uri) throw new Error("A local audio file URI is required.");
    if (signal?.aborted) throw makeStartupAbortError();
    if (activeSession) {
      throw new Error("A phone-native recognition session is already active.");
    }

    const session = {
      subscriptions: [],
      startupController: new AbortController(),
      started: false,
      releaseMicrophone: null,
      lastFinalText: null,
      ended: false,
    };
    activeSession = session;

    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (signal?.aborted) throw makeStartupAbortError();
      if (!permission.granted) {
        throw new Error("Microphone or speech-recognition permission was denied.");
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
        finish(makeStartupAbortError());
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
        session.started = true;
        ExpoSpeechRecognitionModule.start({
          lang: language,
          interimResults: false,
          continuous: false,
          iosTaskHint: "dictation",
          requiresOnDeviceRecognition: false,
          audioSource: { uri },
        });
      } catch (error) {
        finish(error);
      }
    });
  },
};
