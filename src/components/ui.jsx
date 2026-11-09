import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export const colors = {
  background: "#F3F6FA",
  card: "#FFFFFF",
  ink: "#172B4D",
  muted: "#52627A",
  border: "#D9E1EC",
  primary: "#135C78",
  primaryDark: "#0E455B",
  paleBlue: "#E8F3F7",
  success: "#226643",
  paleGreen: "#EAF5EF",
  danger: "#9B2C2C",
  paleRed: "#FCEEEE",
  amber: "#76510C",
  paleAmber: "#FFF4D8",
};

export function PageShell({ children, contentStyle }) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={[styles.page, contentStyle]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function PageHeading({ eyebrow, title, description }) {
  return (
    <View style={styles.heading}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({
  title,
  onPress,
  disabled = false,
  secondary = false,
  destructive = false,
  accessibilityLabel,
}) {
  const buttonStyle = destructive
    ? styles.destructiveButton
    : secondary
      ? styles.secondaryButton
      : styles.primaryButton;
  const textStyle = secondary ? styles.secondaryButtonText : styles.buttonText;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        buttonStyle,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
      ]}
    >
      <Text style={[textStyle, destructive && styles.destructiveText]}>{title}</Text>
    </Pressable>
  );
}

export function StatusMessage({ children, tone = "info" }) {
  const toneStyle =
    tone === "success"
      ? styles.successMessage
      : tone === "error"
        ? styles.errorMessage
        : tone === "warning"
          ? styles.warningMessage
          : styles.infoMessage;

  return (
    <View accessibilityLiveRegion="polite" style={[styles.message, toneStyle]}>
      <Text style={styles.messageText}>{children}</Text>
    </View>
  );
}

export function FieldLabel({ children }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

export function MetadataLine({ label, value }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <View style={styles.metadataLine}>
      <Text style={styles.metadataLabel}>{label}</Text>
      <Text selectable style={styles.metadataValue}>{String(value)}</Text>
    </View>
  );
}

export const uiStyles = styles;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  page: { padding: 18, paddingBottom: 28, gap: 16 },
  heading: { gap: 7, marginBottom: 2 },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  title: { color: colors.ink, fontSize: 27, fontWeight: "800" },
  description: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  button: {
    alignItems: "center",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  primaryButton: { backgroundColor: colors.primary },
  secondaryButton: { backgroundColor: colors.paleBlue, borderColor: colors.border, borderWidth: 1 },
  destructiveButton: { backgroundColor: colors.paleRed, borderColor: "#EBCACA", borderWidth: 1 },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  secondaryButtonText: { color: colors.primaryDark, fontSize: 15, fontWeight: "700" },
  destructiveText: { color: colors.danger },
  disabledButton: { opacity: 0.45 },
  pressedButton: { opacity: 0.78 },
  message: { borderRadius: 11, borderWidth: 1, padding: 12 },
  infoMessage: { backgroundColor: colors.paleBlue, borderColor: "#C8DFE8" },
  successMessage: { backgroundColor: colors.paleGreen, borderColor: "#C5E0CF" },
  errorMessage: { backgroundColor: colors.paleRed, borderColor: "#EBCACA" },
  warningMessage: { backgroundColor: colors.paleAmber, borderColor: "#F0D99D" },
  messageText: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  fieldLabel: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  metadataLine: { gap: 3 },
  metadataLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  metadataValue: { color: colors.ink, fontSize: 14, lineHeight: 20 },
});
