import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "../theme";

export function Surface({ children, style }) {
  return <View style={[styles.surface, style]}>{children}</View>;
}

export function ActionCard({ title, subtitle, onPress, accent = theme.colors.ink, icon = "chevron-right" }) {
  return (
    <Pressable onPress={onPress} style={styles.actionCard}>
      <View style={[styles.actionIcon, { borderColor: accent }]}>
        <MaterialCommunityIcons name={icon} size={18} color={accent} />
      </View>
      <View style={styles.actionBody}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.inkMuted} />
    </Pressable>
  );
}

export function MetricCard({ label, value, tone = theme.colors.ink }) {
  return (
    <View style={[styles.metricCard, { minWidth: "48%", flex: 1 }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.metric, { color: tone }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 8,
    ...theme.shadow.card,
  },
  actionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...theme.shadow.card,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceAlt,
  },
  actionBody: {
    flex: 1,
    gap: 3,
  },
  metricCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 8,
    ...theme.shadow.card,
  },
  label: {
    color: theme.colors.inkSoft,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "700",
  },
  title: {
    color: theme.colors.ink,
    fontWeight: "700",
    fontSize: 16,
  },
  metric: {
    fontWeight: "700",
    fontSize: 25,
  },
  subtitle: {
    color: theme.colors.inkSoft,
    lineHeight: 19,
    fontSize: 13,
  },
});
