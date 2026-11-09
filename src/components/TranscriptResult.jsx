import { Text, View } from "react-native";
import { Card, colors, FieldLabel, MetadataLine, StatusMessage } from "./ui";

export default function TranscriptResult({ result, error, details = true }) {
  if (error) return <StatusMessage tone="error">{error}</StatusMessage>;
  if (!result) return null;

  const isError = result.status === "error";

  return (
    <Card>
      <FieldLabel>{isError ? "Transcription error" : "Transcript result"}</FieldLabel>
      <StatusMessage tone={isError ? "error" : "success"}>
        {isError ? result.errorMessage : result.transcript || "No speech was recognized."}
      </StatusMessage>
      {!isError ? (
        <Text selectable style={{ color: colors.ink, fontSize: 16, lineHeight: 24 }}>
          {result.transcript || "(Empty transcript)"}
        </Text>
      ) : null}
      <MetadataLine label="Processing time" value={formatDuration(result.durationMs)} />
      <MetadataLine label="Model" value={result.model} />
      <MetadataLine label="Returned model" value={result.returnedModel} />
      {details && result.responseDetails ? (
        <View style={{ gap: 7 }}>
          <FieldLabel>Normalized response details</FieldLabel>
          <Text selectable style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
            {JSON.stringify(result.responseDetails, null, 2)}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

export function formatDuration(durationMs) {
  if (typeof durationMs !== "number") return "";
  return `${(durationMs / 1000).toFixed(2)} s`;
}
