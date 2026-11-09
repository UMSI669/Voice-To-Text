import { Pressable, StyleSheet, Text, View } from "react-native";
import { audioSamples } from "../data/audioSamples";
import { colors, FieldLabel } from "./ui";

export default function SamplePicker({ selectedId, onChange, disabled = false }) {
  return (
    <View style={styles.container}>
      <FieldLabel>WAV sample</FieldLabel>
      {audioSamples.map((sample) => {
        const selected = selectedId === sample.id;
        return (
          <Pressable
            key={sample.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(sample.id)}
            style={[styles.option, selected && styles.selected, disabled && styles.disabled]}
          >
            <Text style={styles.name}>{sample.filename}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  option: { borderColor: colors.border, borderRadius: 10, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: 12 },
  selected: { backgroundColor: colors.paleBlue, borderColor: colors.primary },
  disabled: { opacity: 0.5 },
  name: { color: colors.ink, fontSize: 13, fontWeight: "600" },
});
