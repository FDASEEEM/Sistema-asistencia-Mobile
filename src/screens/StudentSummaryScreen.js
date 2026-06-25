import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import { MetricCard, Surface } from "../components/Cards";
import { mobileApi } from "../api/client";
import { theme } from "../theme";

export default function StudentSummaryScreen({ route }) {
  const { student } = route.params;
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await mobileApi.get(`/apoderados/estudiantes/${student.id}/resumen`);
      setSummary(data);
    })();
  }, [student.id]);

  return (
    <Screen eyebrow={student.curso_nombre} title={`${student.nombre} ${student.apellido}`} subtitle="Una lectura clara del mes, con foco en lo que realmente importa.">
      <Surface style={styles.highlightCard}>
        <View style={styles.highlightTop}>
          <View>
            <Text style={styles.highlightEyebrow}>Asistencia actual</Text>
            <Text style={styles.highlightValue}>{summary?.porcentaje_asistencia || 0}%</Text>
          </View>
          <View style={styles.highlightIconWrap}>
            <MaterialCommunityIcons name="chart-line" size={23} color={theme.colors.ink} />
          </View>
        </View>
        <Text style={styles.highlightText}>Resumen rapido del comportamiento del mes para tomar decisiones sin revisar varias pantallas.</Text>
      </Surface>

      <View style={styles.metrics}>
        <MetricCard label="Atrasos mes" value={summary?.total_atrasos_mes || 0} tone={theme.colors.warning} />
        <MetricCard label="Salidas mes" value={summary?.total_salidas_mes || 0} tone={theme.colors.danger} />
        <MetricCard label="Promedio retraso" value={`${summary?.promedio_minutos_retraso || 0} min`} tone={theme.colors.ink} />
        <MetricCard label="Curso" value={student.curso_nombre || "-"} tone={theme.colors.ink} />
      </View>

      <Surface>
        <Text style={styles.sectionTitle}>Eventos recientes</Text>
        {(summary?.eventos_recientes || []).map((item, index) => (
          <View key={`${item.tipo}-${index}`} style={[styles.eventRow, index ? styles.eventBorder : null]}>
            <View style={styles.eventDot} />
            <View style={styles.eventCopy}>
              <Text style={styles.eventType}>{item.tipo.toUpperCase()}</Text>
              <Text style={styles.eventDetail}>{item.fecha} · {item.detalle}</Text>
            </View>
          </View>
        ))}
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  highlightCard: {
    backgroundColor: theme.colors.surface,
    gap: 12,
  },
  highlightTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  highlightEyebrow: {
    color: theme.colors.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontSize: 11,
    fontWeight: "700",
  },
  highlightValue: {
    color: theme.colors.ink,
    fontSize: 32,
    fontWeight: "700",
    marginTop: 6,
  },
  highlightText: {
    color: theme.colors.inkSoft,
    lineHeight: 20,
  },
  highlightIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  sectionTitle: {
    color: theme.colors.ink,
    fontWeight: "700",
    marginBottom: 8,
    fontSize: 16,
  },
  eventRow: {
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  eventBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  eventDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: theme.colors.ink,
    marginTop: 6,
  },
  eventCopy: {
    flex: 1,
  },
  eventType: {
    color: theme.colors.ink,
    fontWeight: "700",
  },
  eventDetail: {
    color: theme.colors.inkSoft,
    marginTop: 4,
    lineHeight: 19,
  },
});
