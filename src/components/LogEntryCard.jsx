import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { engineNames } from "../services/stt";
import { Card, colors, MetadataLine, StatusMessage } from "./ui";
import { formatDuration } from "./TranscriptResult";

export default function LogEntryCard({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const isError = entry.status === "error";
  const timestamp = new Date(entry.createdAt).toLocaleString();

  return (
    <Card>
      <View style={{ alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
        <Text style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "800" }}>
          {engineNames[entry.engine] || entry.engine}
        </Text>
        <Text style={{ color: isError ? colors.danger : colors.success, fontSize: 12, fontWeight: "800" }}>
          {isError ? "ERROR" : "SUCCESS"}
        </Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{timestamp}</Text>
      <MetadataLine label="Model" value={entry.model} />
      <MetadataLine label="Returned model" value={entry.returnedModel} />
      <MetadataLine label="Source" value={entry.source === "sample" ? "WAV sample" : "Microphone"} />
      <MetadataLine label="Filename" value={entry.filename} />
      <MetadataLine label="Processing time" value={formatDuration(entry.durationMs)} />
      {isError ? (
        <StatusMessage tone="error">{entry.errorMessage || "Transcription failed."}</StatusMessage>
      ) : (
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Transcript</Text>
          <Text selectable style={{ color: colors.ink, fontSize: 15, lineHeight: 22 }}>
            {entry.transcript || "(Empty transcript)"}
          </Text>
        </View>
      )}
      {entry.expectedText ? (
        <>
          <MetadataLine label="Expected text" value={entry.expectedText} />
          <MetadataLine
            label="Word error rate (punctuation and capitalization ignored)"
            value={typeof entry.wordErrorRate === "number" ? `${(entry.wordErrorRate * 100).toFixed(1)}%` : "Not calculated"}
          />
        </>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={expanded ? "Hide normalized response details" : "Show normalized response details"}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={{ minHeight: 44, justifyContent: "center" }}
      >
        <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700" }}>
          {expanded ? "Hide response details" : "Show response details"}
        </Text>
      </Pressable>
      {expanded ? (
        <Text selectable style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
          {JSON.stringify(entry.responseDetails || {}, null, 2)}
        </Text>
      ) : null}
    </Card>
  );
}
