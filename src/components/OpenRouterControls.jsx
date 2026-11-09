import { useEffect, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { isOpenRouterConfigured, getMissingOpenRouterEnvItems } from "../services/stt/openRouterConfig";
import { loadOpenRouterModels } from "../store/loadOpenRouterModels";
import { modelSelected } from "../store/openRouterModelsSlice";
import { Card, colors, FieldLabel, PrimaryButton, StatusMessage } from "./ui";

const MISSING_CONFIG_MESSAGE = "OpenRouter env items need to be provided in .env for it to work.";

export default function OpenRouterControls({ disabled = false }) {
  const dispatch = useDispatch();
  const models = useSelector((state) => state.openRouterModels);
  const [pickerVisible, setPickerVisible] = useState(false);
  const configured = isOpenRouterConfigured();
  const selected = models.items.find((item) => item.id === models.selectedModelId);
  const missingItems = getMissingOpenRouterEnvItems();

  useEffect(() => {
    if (configured) dispatch(loadOpenRouterModels());
  }, [configured, dispatch]);

  const refresh = () => dispatch(loadOpenRouterModels({ force: true }));

  return (
    <>
      <Card>
        <FieldLabel>OpenRouter settings</FieldLabel>
        {!configured ? (
          <>
            <StatusMessage tone="warning">{MISSING_CONFIG_MESSAGE}</StatusMessage>
            {missingItems.map((item) => (
              <Text key={item} selectable style={styles.missingItem}>{item}</Text>
            ))}
          </>
        ) : null}

        {configured && models.status === "loading" ? (
          <StatusMessage>Loading transcription models…</StatusMessage>
        ) : null}
        {configured && models.status === "failed" ? (
          <StatusMessage tone="error">{models.error || "Could not load OpenRouter models."}</StatusMessage>
        ) : null}
        {configured && models.status === "succeeded" && models.items.length === 0 ? (
          <StatusMessage tone="warning">No transcription models were returned by the filtered model-list endpoint.</StatusMessage>
        ) : null}

        <View style={styles.buttonRow}>
          <PrimaryButton
            title="Choose model"
            secondary
            disabled={!configured || !models.items.length || disabled}
            onPress={() => setPickerVisible(true)}
          />
          <PrimaryButton
            title={models.status === "loading" ? "Refreshing…" : "Refresh models"}
            secondary
            disabled={!configured || models.status === "loading" || disabled}
            onPress={refresh}
          />
        </View>

        {selected ? (
          <View style={styles.selection}>
            <Text style={styles.modelName}>{selected.name}</Text>
            <Text selectable style={styles.modelId}>{selected.id}</Text>
          </View>
        ) : configured && models.status === "succeeded" ? (
          <Text style={styles.helpText}>Choose a model before transcribing.</Text>
        ) : null}
      </Card>

      <Modal
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
        transparent
        visible={pickerVisible}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text accessibilityRole="header" style={styles.modalTitle}>Transcription models</Text>
            <FlatList
              data={models.items}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${item.id}`}
                  onPress={() => {
                    dispatch(modelSelected(item.id));
                    setPickerVisible(false);
                  }}
                  style={styles.modelOption}
                >
                  <Text style={styles.modelName}>{item.name}</Text>
                  <Text selectable style={styles.modelId}>{item.id}</Text>
                  {item.description ? <Text style={styles.helpText}>{item.description}</Text> : null}
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.helpText}>No models are available.</Text>}
            />
            <PrimaryButton title="Close" secondary onPress={() => setPickerVisible(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

export function hasValidSelectedModel(modelState) {
  return Boolean(
    isOpenRouterConfigured() &&
      modelState.selectedModelId &&
      modelState.items.some((item) => item.id === modelState.selectedModelId),
  );
}

const styles = StyleSheet.create({
  buttonRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  missingItem: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  selection: { borderTopColor: colors.border, borderTopWidth: 1, gap: 3, paddingTop: 10 },
  modelName: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  modelId: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  helpText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  modalBackdrop: { backgroundColor: "rgba(12, 27, 45, 0.5)", flex: 1, justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, gap: 14, maxHeight: "85%", padding: 20 },
  modalTitle: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  modelOption: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4, paddingVertical: 13 },
});
