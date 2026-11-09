import { Tabs } from "expo-router";
import { colors } from "../../components/ui";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", paddingBottom: 2 },
        tabBarItemStyle: { minHeight: 56, paddingHorizontal: 1 },
        tabBarStyle: { borderTopColor: colors.border, height: 64, paddingTop: 5 },
      }}
    >
      <Tabs.Screen name="native" options={{ title: "Phone-native", tabBarLabel: "Native" }} />
      <Tabs.Screen name="on-device" options={{ title: "On-device AI", tabBarLabel: "On-device" }} />
      <Tabs.Screen name="cloud" options={{ title: "Cloud AI", tabBarLabel: "Cloud" }} />
      <Tabs.Screen name="samples" options={{ title: "WAV samples", tabBarLabel: "WAV samples" }} />
      <Tabs.Screen name="logs" options={{ title: "Logs", tabBarLabel: "Logs" }} />
    </Tabs>
  );
}
