import { Pressable, StyleSheet, Text, View } from "react-native";
import { engineNames } from "../services/stt";
import { colors, FieldLabel } from "./ui";

const engines = ["phone-native", "phone-ai", "cloud-ai"];

export default function EnginePicker({ value, onChange, disabled = false }) {
  return (
    <View style={styles.container}>
      <FieldLabel>Transcription engine</FieldLabel>
      {engines.map((engine) => {
        const selected = value === engine;
        return (
          <Pressable
            key={engine}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(engine)}
            style={[styles.option, selected && styles.selectedOption, disabled && styles.disabled]}
          >
            <View style={[styles.radio, selected && styles.selectedRadio]} />
            <Text style={styles.label}>{engineNames[engine]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  option: { alignItems: "center", borderColor: colors.border, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 46, paddingHorizontal: 12 },
  selectedOption: { backgroundColor: colors.paleBlue, borderColor: colors.primary },
  disabled: { opacity: 0.5 },
  radio: { borderColor: colors.muted, borderRadius: 9, borderWidth: 1.5, height: 18, width: 18 },
  selectedRadio: { backgroundColor: colors.primary, borderColor: colors.primary, borderWidth: 5 },
  label: { color: colors.ink, fontSize: 14, fontWeight: "600" },
});
