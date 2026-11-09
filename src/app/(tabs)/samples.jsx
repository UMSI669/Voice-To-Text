import { nanoid } from "@reduxjs/toolkit";
import { useAudioPlayer } from "expo-audio";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import EnginePicker from "../../components/EnginePicker";
import OpenRouterControls, { hasValidSelectedModel } from "../../components/OpenRouterControls";
import SamplePicker from "../../components/SamplePicker";
import TranscriptResult from "../../components/TranscriptResult";
import { Card, colors, FieldLabel, PageHeading, PageShell, PrimaryButton, StatusMessage } from "../../components/ui";
import { audioSamples } from "../../data/audioSamples";
import { resolveSampleAudio } from "../../services/audio/resolveSampleAudio";
import { safeErrorMessage } from "../../services/audio/recording";
import { wordErrorRate } from "../../services/comparison/wordErrorRate";
import { sttAdapters } from "../../services/stt";
import { onDeviceStt } from "../../services/stt/onDeviceStt";
import { sttResponseReceived } from "../../store/sttLogsSlice";

const engineDescriptions = {
  "phone-native": "Uses the phone operating-system speech-recognition service. Processing may occur on-device or remotely.",
  "phone-ai": "Runs a speech-to-text model locally on this device.",
  "cloud-ai": "Sends the selected WAV to OpenRouter using the selected model.",
};

export default function SamplesScreen() {
  const dispatch = useDispatch();
  const modelState = useSelector((state) => state.openRouterModels);
  const [selectedSampleId, setSelectedSampleId] = useState(audioSamples[0].id);
  const [engine, setEngine] = useState("cloud-ai");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [localModelStatus, setLocalModelStatus] = useState("unknown");
  const abortControllerRef = useRef(null);
  const selectedSample = audioSamples.find((sample) => sample.id === selectedSampleId) || audioSamples[0];
  const player = useAudioPlayer(selectedSample.asset);
  const adapter = sttAdapters[engine];
  const cloudModelIsValid = hasValidSelectedModel(modelState);
  useEffect(() => {
    let isCurrent = true;
    if (engine === "phone-ai") {
      onDeviceStt.getModelStatus().then((status) => {
        if (isCurrent) setLocalModelStatus(status.status);
      }).catch(() => {
        if (isCurrent) setLocalModelStatus("error");
      });
    }
    return () => { isCurrent = false; };
  }, [engine]);
  const canTranscribe =
    adapter.capabilities.audioFile &&
    !adapter.capabilities.unavailableReason &&
    (engine !== "cloud-ai" || cloudModelIsValid) &&
    (engine !== "phone-ai" || localModelStatus === "ready");

  useFocusEffect(
    useCallback(() => () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    }, []),
  );

  const playSample = () => {
    player.seekTo(0);
    player.play();
  };

  const transcribeSample = async () => {
    if (busy || !canTranscribe) return;

    // Snapshot the user's sample, engine, and model selection at submission time.
    const sample = selectedSample;
    const requestedEngine = engine;
    const requestedModel = requestedEngine === "cloud-ai"
      ? modelState.selectedModelId
      : adapter.model?.id || null;
    const submittedAsset = requestedEngine === "phone-native"
      ? sample.phoneNativeAsset
      : sample.asset;
    const submittedFilename = requestedEngine === "phone-native"
      ? sample.phoneNativeFilename
      : sample.filename;
    const requestId = nanoid();
    const startedAt = Date.now();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setBusy(true);
    setError("");
    setResult(null);

    let requestTimedOut = false;
    const timeout = setTimeout(() => {
      requestTimedOut = true;
      controller.abort();
    }, 90_000);
    try {
      const uri = await resolveSampleAudio(submittedAsset);
      if (controller.signal.aborted) return;
      const response = await sttAdapters[requestedEngine].transcribeFile({
        uri,
        filename: submittedFilename,
        mimeType: "audio/wav",
        language: sample.language,
        model: requestedModel,
        signal: controller.signal,
      });

      const transcript = response.transcript || "";
      const entry = {
        id: nanoid(),
        requestId,
        createdAt: new Date().toISOString(),
        engine: requestedEngine,
        model: response.model || requestedModel,
        returnedModel: response.returnedModel || null,
        source: "sample",
        sampleId: sample.id,
        filename: submittedFilename,
        expectedText: sample.expectedText,
        status: "success",
        transcript,
        durationMs: Date.now() - startedAt,
        language: response.language || null,
        wordErrorRate: sample.expectedText ? wordErrorRate(sample.expectedText, transcript) : null,
        responseDetails: response.responseDetails || { text: transcript },
      };

      setResult(entry);
      dispatch(sttResponseReceived(entry));
    } catch (caughtError) {
      if (!requestTimedOut && (controller.signal.aborted || caughtError?.name === "AbortError")) return;
      const message = requestTimedOut
        ? "Transcription timed out after 90 seconds."
        : safeErrorMessage(caughtError);
      const entry = {
        id: nanoid(),
        requestId,
        createdAt: new Date().toISOString(),
        engine: requestedEngine,
        model: requestedModel,
        returnedModel: null,
        source: "sample",
        sampleId: sample.id,
        filename: submittedFilename,
        expectedText: sample.expectedText,
        status: "error",
        transcript: "",
        errorMessage: message,
        durationMs: Date.now() - startedAt,
      };
      setError(message);
      setResult(entry);
      dispatch(sttResponseReceived(entry));
    } finally {
      clearTimeout(timeout);
      abortControllerRef.current = null;
      setBusy(false);
    }
  };

  const cancel = () => abortControllerRef.current?.abort();

  return (
    <PageShell>
      <PageHeading
        eyebrow="Compare engines"
        title="WAV samples"
        description="Submit a bundled WAV file to any engine that supports this file format. Audio is never submitted until you press Transcribe."
      />

      <Card>
        <SamplePicker selectedId={selectedSample.id} onChange={(id) => { setSelectedSampleId(id); setResult(null); setError(""); }} disabled={busy} />
        <FieldLabel>Filename</FieldLabel>
        <Text selectable style={{ color: colors.ink, fontSize: 14 }}>{selectedSample.filename}</Text>
        {engine === "phone-native" ? (
          <>
            <FieldLabel>Phone-native WAV sent</FieldLabel>
            <Text selectable style={{ color: colors.ink, fontSize: 14 }}>
              {selectedSample.phoneNativeFilename}
            </Text>
          </>
        ) : null}
        <FieldLabel>Expected spoken words</FieldLabel>
        {selectedSample.expectedText ? (
          <Text selectable style={{ color: colors.ink, fontSize: 15, lineHeight: 22 }}>{selectedSample.expectedText}</Text>
        ) : (
          <StatusMessage tone="warning">
            Reference transcript not supplied. Add the actual spoken words to expectedText in src/data/audioSamples.js to calculate WER.
          </StatusMessage>
        )}
        <PrimaryButton title="Play sample" secondary onPress={playSample} disabled={busy} />
      </Card>

      <Card>
        <EnginePicker value={engine} onChange={(value) => { setEngine(value); setResult(null); setError(""); }} disabled={busy} />
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>{engineDescriptions[engine]}</Text>
      </Card>

      {engine === "cloud-ai" ? <OpenRouterControls disabled={busy} /> : null}

      {engine === "phone-native" && !adapter.capabilities.audioFile ? (
        <StatusMessage tone="warning">{adapter.capabilities.audioFileUnavailableReason}</StatusMessage>
      ) : null}
      {engine === "phone-ai" && !adapter.capabilities.audioFile ? (
        <StatusMessage tone="warning">{adapter.capabilities.unavailableReason}</StatusMessage>
      ) : null}
      {engine === "phone-ai" && adapter.capabilities.audioFile && localModelStatus !== "ready" ? (
        <StatusMessage tone="warning">Download the local Whisper model from the On-device AI tab before submitting this sample.</StatusMessage>
      ) : null}

      <Card>
        <PrimaryButton
          title={busy ? "Transcribing…" : "Transcribe sample"}
          disabled={!canTranscribe || busy}
          onPress={transcribeSample}
        />
        {busy ? (
          <>
            <StatusMessage>{engine === "cloud-ai" ? "Uploading WAV to OpenRouter…" : "Running local or OS transcription…"}</StatusMessage>
            <ActivityIndicator accessibilityLabel="Transcribing WAV sample" color={colors.primary} />
            <PrimaryButton title="Cancel" secondary onPress={cancel} />
          </>
        ) : null}
        {engine === "cloud-ai" && !canTranscribe && modelState.status === "succeeded" && modelState.items.length > 0 ? (
          <StatusMessage tone="warning">Choose a valid OpenRouter transcription model before submitting.</StatusMessage>
        ) : null}
        <TranscriptResult result={result} error={error} />
        {result?.status === "success" ? (
          <View style={{ gap: 6 }}>
            {selectedSample.expectedText ? (
              <>
                <FieldLabel>Word error rate</FieldLabel>
                <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "800" }}>
                  {typeof result.wordErrorRate === "number" ? `${(result.wordErrorRate * 100).toFixed(1)}%` : "Not calculated"}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
                  Punctuation and capitalization are ignored. WER may exceed 100%; it is not a percentage accuracy score.
                </Text>
              </>
            ) : (
              <StatusMessage>WER is not calculated until an expected transcript is supplied.</StatusMessage>
            )}
          </View>
        ) : null}
      </Card>
    </PageShell>
  );
}
