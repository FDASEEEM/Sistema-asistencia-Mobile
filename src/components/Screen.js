import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

export default function Screen({ eyebrow, title, subtitle, children, scroll = true, right, variant = "default" }) {
  const Container = scroll ? ScrollView : View;
  const isHero = variant === "hero";

  return (
    <SafeAreaView style={styles.safe}>
      <Container contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isHero ? (
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <Text style={styles.heroEyebrow}>{eyebrow}</Text>
              {right}
            </View>
            <Text style={styles.heroTitle}>{title}</Text>
            {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
          </View>
        ) : (
          <View style={styles.headerBlock}>
            <View style={styles.headerTopRow}>
              <View style={styles.headerCopy}>
                {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
              {right}
            </View>
          </View>
        )}

        {children}
      </Container>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 34,
    gap: 14,
  },
  headerBlock: {
    paddingTop: 8,
    paddingBottom: 6,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: theme.colors.inkSoft,
    fontWeight: "700",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  title: {
    color: theme.colors.ink,
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: 0,
  },
  subtitle: {
    color: theme.colors.inkSoft,
    marginTop: 6,
    lineHeight: 20,
    maxWidth: "96%",
    fontSize: 14,
  },
  heroCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.xxl,
    padding: 22,
    minHeight: 176,
    justifyContent: "space-between",
    ...theme.shadow.hero,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroEyebrow: {
    color: "#d1d5db",
    fontWeight: "700",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: theme.colors.white,
    fontSize: 30,
    fontWeight: "700",
    marginTop: 20,
    letterSpacing: 0,
  },
  heroSubtitle: {
    color: "#e5e7eb",
    marginTop: 10,
    lineHeight: 21,
    maxWidth: "94%",
  },
});
