import { useCallback } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import LogEntryCard from "../../components/LogEntryCard";
import { colors, PageHeading, PrimaryButton } from "../../components/ui";
import { logsCleared } from "../../store/sttLogsSlice";

export default function LogsScreen() {
  const dispatch = useDispatch();
  const entries = useSelector((state) => state.sttLogs.entries);

  const confirmClear = useCallback(() => {
    Alert.alert("Clear transcription logs?", "This removes completed results and errors from this app session.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear logs", style: "destructive", onPress: () => dispatch(logsCleared()) },
    ]);
  }, [dispatch]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <FlatList
        contentContainerStyle={styles.content}
        data={entries}
        keyExtractor={(entry) => entry.id}
        ListHeaderComponent={(
          <View style={styles.header}>
            <PageHeading
              eyebrow="Shared Redux state"
              title="Transcription logs"
              description="Completed results and errors from all five pages appear here, newest first. Logs reset when the app restarts."
            />
            <PrimaryButton title="Clear logs" secondary disabled={!entries.length} onPress={confirmClear} />
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No transcription logs yet</Text>
            <Text style={styles.emptyText}>Run a microphone or WAV transcription to add a completed result or error.</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => <LogEntryCard entry={item} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { gap: 12, padding: 18, paddingBottom: 28 },
  header: { gap: 14, marginBottom: 4 },
  empty: { alignItems: "center", backgroundColor: colors.card, borderColor: colors.border, borderRadius: 14, borderWidth: 1, gap: 8, padding: 22 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
});
