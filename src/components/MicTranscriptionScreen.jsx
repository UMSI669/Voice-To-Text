import { nanoid } from "@reduxjs/toolkit";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useMicrophoneTranscription } from "../hooks/useMicrophoneTranscription";
import { safeErrorMessage } from "../services/audio/recording";
import { isOpenRouterConfigured } from "../services/stt/openRouterConfig";
import { nativeStt } from "../services/stt/nativeStt";
import { onDeviceStt } from "../services/stt/onDeviceStt";
import { engineNames } from "../services/stt";
import { sttResponseReceived } from "../store/sttLogsSlice";
import OpenRouterControls, { hasValidSelectedModel } from "./OpenRouterControls";
import TranscriptResult from "./TranscriptResult";
import { Card, FieldLabel, PageHeading, PageShell, PrimaryButton, StatusMessage } from "./ui";

const engineDescriptions = {
  "phone-native":
    "Uses the phone’s operating-system speech-recognition service. Processing may occur on-device or remotely, depending on platform support and configuration.",
  "phone-ai": "Runs a speech-to-text model locally on this device.",
  "cloud-ai": "Sends recorded audio to OpenRouter for transcription using the selected model.",
};

export default function MicTranscriptionScreen({ engine }) {
  const dispatch = useDispatch();
  const modelState = useSelector((state) => state.openRouterModels);
  const configured = isOpenRouterConfigured();
  const selectedModel = modelState.selectedModelId;
  const validCloudModel = hasValidSelectedModel(modelState);
  const microphone = useMicrophoneTranscription({
    engine,
    model: engine === "cloud-ai" ? selectedModel : onDeviceStt.model.id,
  });
  const [nativeStatus, setNativeStatus] = useState("idle");
  const [nativePartial, setNativePartial] = useState("");
  const [nativeError, setNativeError] = useState("");
  const [nativeAvailability, setNativeAvailability] = useState(null);
  const [nativeResult, setNativeResult] = useState(null);
  const [modelStatus, setModelStatus] = useState({ status: "loading" });
  const [modelProgress, setModelProgress] = useState(null);
  const [modelError, setModelError] = useState("");
  const nativeRequestIdRef = useRef(null);
  const nativeStartedAtRef = useRef(null);
  const nativeErrorLoggedRef = useRef(false);
  const modelDownloadControllerRef = useRef(null);

  useEffect(() => {
    if (engine !== "phone-native") return undefined;
    let isCurrent = true;
    nativeStt.getAvailability().then((availability) => {
      if (isCurrent) setNativeAvailability(availability);
    }).catch((error) => {
      if (isCurrent) setNativeError(safeErrorMessage(error));
    });
    return () => { isCurrent = false; };
  }, [engine]);

  useFocusEffect(
    useCallback(() => {
      if (engine !== "phone-ai") return undefined;
      let isCurrent = true;
      onDeviceStt.getModelStatus().then((status) => {
        console.log("[Local STT] getModelStatus:", status);
        if (isCurrent) setModelStatus(status);
      }).catch((error) => {
        console.error("[Local STT] getModelStatus failed:", error);
        if (isCurrent) {
          setModelStatus({ status: "error" });
          setModelError(safeErrorMessage(error, "Could not inspect the local model."));
        }
      });
      return () => {
        isCurrent = false;
        modelDownloadControllerRef.current?.abort();
      };
    }, [engine]),
  );

  useFocusEffect(
    useCallback(() => {
      if (engine !== "phone-native") return undefined;
      return () => {
        nativeRequestIdRef.current = null;
        setNativeStatus("idle");
        void nativeStt.cancelListening();
      };
    }, [engine]),
  );

  const downloadModel = async () => {
    const controller = new AbortController();
    modelDownloadControllerRef.current = controller;
    setModelError("");
    setModelProgress(0);
    setModelStatus({ status: "downloading" });
    try {
      await onDeviceStt.downloadModel({
        signal: controller.signal,
        onProgress: setModelProgress,
      });
      const nextStatus = await onDeviceStt.getModelStatus();
      setModelStatus(nextStatus);
    } catch (error) {
      if (error?.name !== "AbortError" && !controller.signal.aborted) {
        setModelError(safeErrorMessage(error, "The local model could not be downloaded."));
        setModelStatus({ status: "error" });
      } else {
        setModelStatus({ status: "missing" });
      }
    } finally {
      modelDownloadControllerRef.current = null;
      setModelProgress(null);
    }
  };

  const logNativeError = (error) => {
    if (nativeErrorLoggedRef.current) return;
    nativeErrorLoggedRef.current = true;
    const message = safeErrorMessage(error);
    const entry = {
      id: nanoid(),
      requestId: nativeRequestIdRef.current || nanoid(),
      createdAt: new Date().toISOString(),
      engine,
      model: null,
      source: "microphone",
      status: "error",
      transcript: "",
      errorMessage: message,
      durationMs: nativeStartedAtRef.current ? Date.now() - nativeStartedAtRef.current : 0,
    };
    setNativeError(message);
    setNativeResult(entry);
    dispatch(sttResponseReceived(entry));
  };

  const startNativeListening = async () => {
    if (nativeStatus === "listening" || nativeStatus === "starting") return;
    const requestId = nanoid();
    nativeRequestIdRef.current = requestId;
    nativeStartedAtRef.current = Date.now();
    nativeErrorLoggedRef.current = false;
    setNativePartial("");
    setNativeError("");
    setNativeResult(null);
    setNativeStatus("starting");

    try {
      await nativeStt.startListening({
        onPartial: (text) => {
          if (nativeRequestIdRef.current === requestId) setNativePartial(text);
        },
        onFinal: (response) => {
          if (nativeRequestIdRef.current !== requestId) return;
          if (nativeErrorLoggedRef.current) return;
          const entry = {
            id: nanoid(),
            requestId: nativeRequestIdRef.current,
            createdAt: new Date().toISOString(),
            engine,
            model: null,
            source: "microphone",
            status: "success",
            transcript: response.transcript || "",
            durationMs: nativeStartedAtRef.current ? Date.now() - nativeStartedAtRef.current : 0,
            language: response.language || null,
            responseDetails: response.responseDetails || { text: response.transcript || "" },
          };
          setNativeResult(entry);
          dispatch(sttResponseReceived(entry));
        },
        onError: (error) => {
          if (nativeRequestIdRef.current === requestId) logNativeError(error);
        },
        onEnd: () => {
          if (nativeRequestIdRef.current === requestId) setNativeStatus("idle");
        },
      });
      if (nativeRequestIdRef.current !== requestId) return;
      setNativeStatus("listening");
      setNativeAvailability((previous) => ({
        ...previous,
        available: true,
        permissionGranted: true,
      }));
    } catch (error) {
      if (nativeRequestIdRef.current !== requestId) return;
      if (error?.name !== "AbortError") logNativeError(error);
      setNativeStatus("idle");
    }
  };

  const stopNativeListening = async () => {
    setNativeStatus("stopping");
    try {
      await nativeStt.stopListening();
    } catch (error) {
      logNativeError(error);
      setNativeStatus("idle");
    }
  };

  const busy = ["recording", "processing"].includes(microphone.status) ||
    ["starting", "listening", "stopping"].includes(nativeStatus);
  const cloudCanSubmit = configured && validCloudModel;
  const localModelReady = modelStatus.status === "ready";
  const captureDisabled = engine === "cloud-ai"
    ? !cloudCanSubmit
    : engine === "phone-ai"
      ? !localModelReady
      : false;

  return (
    <PageShell>
      <PageHeading
        eyebrow="Speech-to-text"
        title={engineNames[engine]}
        description={engineDescriptions[engine]}
      />

      {engine === "phone-native" ? (
        <>
          <Card>
            <FieldLabel>Phone capability</FieldLabel>
            <StatusMessage tone={nativeAvailability?.available ? "success" : "info"}>
              {nativeAvailability?.message || "Checking the phone’s speech-recognition service…"}
            </StatusMessage>
            {nativeAvailability?.available ? (
              <Text style={{ color: "#52627A", fontSize: 13, lineHeight: 19 }}>
                OS speech services may use network processing. This page does not force on-device recognition.
              </Text>
            ) : null}
          </Card>
          <Card>
            <FieldLabel>Live recognition</FieldLabel>
            <View style={{ flexDirection: "row", gap: 9 }}>
              {nativeStatus === "listening" || nativeStatus === "stopping" ? (
                <PrimaryButton title="Stop listening" onPress={stopNativeListening} />
              ) : (
                <PrimaryButton
                  title={nativeStatus === "starting" ? "Starting…" : "Start listening"}
                  disabled={nativeStatus === "starting" || nativeStatus === "stopping" || nativeAvailability?.available === false}
                  onPress={startNativeListening}
                />
              )}
              {nativeStatus === "listening" ? (
                <PrimaryButton title="Cancel" secondary onPress={() => nativeStt.cancelListening().then(() => setNativeStatus("idle"))} />
              ) : null}
            </View>
            {nativeStatus === "listening" ? <StatusMessage tone="success">Listening…</StatusMessage> : null}
            <FieldLabel>Partial transcript</FieldLabel>
            <Text selectable style={{ color: "#52627A", fontSize: 15, lineHeight: 22 }}>
              {nativePartial || "Your in-progress words will appear here."}
            </Text>
          </Card>
          <TranscriptResult result={nativeResult} error={nativeError} />
        </>
      ) : null}

      {engine === "phone-ai" ? (
        <>
          <Card>
            <FieldLabel>Local model</FieldLabel>
            <Text style={{ color: "#172B4D", fontSize: 16, fontWeight: "700" }}>{onDeviceStt.model.name}</Text>
            <Text selectable style={{ color: "#52627A", fontSize: 12 }}>{onDeviceStt.model.id}</Text>
            {modelStatus.status === "loading" ? <StatusMessage>Checking local model…</StatusMessage> : null}
            {modelStatus.status === "ready" ? <StatusMessage tone="success">Model is ready on this device.</StatusMessage> : null}
            {modelStatus.status === "missing" ? (
              <>
                <StatusMessage tone="warning">Download the approximately 32 MB model before local transcription.</StatusMessage>
                <PrimaryButton title="Download local model" onPress={downloadModel} />
              </>
            ) : null}
            {modelStatus.status === "downloading" ? (
              <>
                <StatusMessage>Downloading Whisper model… {modelProgress === null ? "" : `${Math.round(modelProgress * 100)}%`}</StatusMessage>
                <ActivityIndicator accessibilityLabel="Downloading local model" color="#135C78" />
                <PrimaryButton title="Cancel download" secondary onPress={() => modelDownloadControllerRef.current?.abort()} />
              </>
            ) : null}
            {modelError ? <StatusMessage tone="error">{modelError}</StatusMessage> : null}
          </Card>
          <RecordingControls
            busy={busy}
            disabled={captureDisabled}
            engine={engine}
            microphone={microphone}
            modelReady={localModelReady}
          />
        </>
      ) : null}

      {engine === "cloud-ai" ? (
        <>
          <OpenRouterControls disabled={busy} />
          <RecordingControls
            busy={busy}
            disabled={captureDisabled}
            engine={engine}
            microphone={microphone}
            modelReady
          />
        </>
      ) : null}
    </PageShell>
  );
}

function RecordingControls({ busy, disabled, engine, microphone, modelReady }) {
  const isRecording = microphone.status === "recording";
  const isProcessing = microphone.status === "processing";
  const format = microphone.recordingFormat;

  return (
    <Card>
      <FieldLabel>Microphone recording</FieldLabel>
      <StatusMessage tone={isRecording ? "success" : "info"}>
        {isRecording
          ? `Recording WAV · ${format?.sampleRate || 16000} Hz · ${format?.encoding || "16-bit PCM"} · ${format?.channels === 1 ? "mono" : "channel count checking"} · ${formatClock(microphone.durationMs)}`
          : isProcessing
            ? engine === "cloud-ai"
              ? "Uploading WAV and waiting for OpenRouter…"
              : "Running local inference on this device…"
            : "Audio is recorded locally as PCM WAV. The recording format is checked when recording stops."}
      </StatusMessage>
      {engine === "phone-ai" && !modelReady ? (
        <StatusMessage tone="warning">Install the local model before starting a recording.</StatusMessage>
      ) : null}
      {isRecording ? (
        <PrimaryButton title="Stop and transcribe" onPress={microphone.stopAndTranscribe} />
      ) : isProcessing ? (
        <>
          {engine === "phone-ai" ? <ActivityIndicator accessibilityLabel="Running local transcription" color="#135C78" /> : null}
          <PrimaryButton title="Cancel transcription" secondary onPress={microphone.cancel} />
        </>
      ) : (
        <PrimaryButton
          title="Start recording"
          disabled={disabled || busy}
          onPress={microphone.startRecording}
        />
      )}
      {typeof microphone.progress === "number" ? (
        <Text style={{ color: "#52627A", fontSize: 13 }}>Inference progress: {Math.round(microphone.progress)}%</Text>
      ) : null}
      <TranscriptResult result={microphone.result} error={microphone.error} />
    </Card>
  );
}

function formatClock(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
