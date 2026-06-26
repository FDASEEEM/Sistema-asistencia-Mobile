import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import { MetricCard, Surface } from "../components/Cards";
import { mobileApi } from "../api/client";
import { theme } from "../theme";
import { readCache, writeCache } from "../utils/cache";

function getStatusMeta(summary) {
  if (!summary) {
    return { label: "Sin datos", tone: theme.colors.inkMuted, icon: "clock-outline" };
  }

  if (summary.estado_resumen === "excelente") {
    return { label: "Mes solido", tone: theme.colors.success, icon: "check-decagram-outline" };
  }

  if (summary.estado_resumen === "estable") {
    return { label: "Ritmo estable", tone: theme.colors.accent, icon: "chart-line" };
  }

  return { label: "Atencion requerida", tone: theme.colors.warning, icon: "alert-circle-outline" };
}

function getEventTone(type) {
  if (type === "atraso") {
    return theme.colors.warning;
  }

  if (type === "salida") {
    return theme.colors.danger;
  }

  return theme.colors.ink;
}

export default function StudentSummaryScreen({ route }) {
  const { student } = route.params;
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cachedAt, setCachedAt] = useState("");

  const loadSummary = async () => {
    setLoading(true);
    setError("");
    const cacheKey = `summary_${student.id}`;

    const cached = await readCache(cacheKey);
    if (cached?.value) {
      setSummary(cached.value);
      setCachedAt(cached.savedAt || "");
    }

    try {
      const { data } = await mobileApi.get(`/apoderados/estudiantes/${student.id}/resumen`);
      setSummary(data);
      setCachedAt(new Date().toISOString());
      await writeCache(cacheKey, data);
    } catch (err) {
      console.warn('[StudentSummaryScreen] loadSummary error:', err);
      if (!cached?.value) {
        setSummary(null);
        setError("No pude cargar el resumen del estudiante.");
      } else {
        setError("Mostrando el ultimo resumen guardado.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [student.id]);

  const statusMeta = useMemo(() => getStatusMeta(summary), [summary]);
  const trendValue = summary ? `${summary.delta_asistencia > 0 ? "+" : ""}${summary.delta_asistencia || 0}%` : "0%";

  const shareSummary = async () => {
    if (!summary) {
      return;
    }

    try {
      await Share.share({
        message:
          `Resumen de ${student.nombre} ${student.apellido}\n` +
          `Asistencia: ${summary.porcentaje_asistencia || 0}%\n` +
          `Ausencias: ${summary.total_ausencias_mes || 0}\n` +
          `Atrasos: ${summary.total_atrasos_mes || 0}\n` +
          `Promedio retraso: ${summary.promedio_minutos_retraso || 0} min`,
      });
    } catch (err) { console.warn('[StudentSummaryScreen] share error:', err); }
  };

  return (
    <Screen eyebrow={student.curso_nombre} title={`${student.nombre} ${student.apellido}`} subtitle="Una lectura clara del mes, con foco en asistencia, atrasos y senales que requieren seguimiento.">
      <Surface style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroEyebrow}>Asistencia actual</Text>
            <Text style={styles.heroValue}>{summary?.porcentaje_asistencia || 0}%</Text>
          </View>
          <View style={[styles.statusBadge, { borderColor: statusMeta.tone }]}>
            <MaterialCommunityIcons name={statusMeta.icon} size={16} color={statusMeta.tone} />
            <Text style={[styles.statusText, { color: statusMeta.tone }]}>{statusMeta.label}</Text>
          </View>
        </View>
        <Text style={styles.heroText}>
          {summary
            ? `${summary.total_registros_asistencia || 0} clases registradas este mes, con ${summary.total_ausencias_mes || 0} ausencias y ${summary.total_atrasos_mes || 0} atrasos.`
            : "Todavia no hay datos cargados para este mes."}
        </Text>
        <View style={styles.heroActions}>
          <Pressable style={styles.secondaryButton} onPress={shareSummary}>
            <MaterialCommunityIcons name="share-variant-outline" size={16} color={theme.colors.ink} />
            <Text style={styles.secondaryButtonText}>Compartir</Text>
          </Pressable>
          {cachedAt ? <Text style={styles.cacheText}>Ultima sincronizacion: {cachedAt.slice(0, 16).replace("T", " ")}</Text> : null}
        </View>
      </Surface>

      {loading ? (
        <Surface style={styles.stateCard}>
          <ActivityIndicator color={theme.colors.accent} />
          <Text style={styles.stateText}>Cargando indicadores del estudiante...</Text>
        </Surface>
      ) : error ? (
        <Surface style={styles.stateCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadSummary}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </Surface>
      ) : (
        <>
          <View style={styles.metrics}>
            <MetricCard label="Atrasos mes" value={summary?.total_atrasos_mes || 0} tone={theme.colors.warning} />
            <MetricCard label="Ausencias mes" value={summary?.total_ausencias_mes || 0} tone={theme.colors.danger} />
            <MetricCard label="Promedio retraso" value={`${summary?.promedio_minutos_retraso || 0} min`} tone={theme.colors.ink} />
            <MetricCard label="Tendencia" value={trendValue} tone={(summary?.delta_asistencia || 0) >= 0 ? theme.colors.success : theme.colors.danger} />
          </View>

          <Surface style={styles.contextCard}>
            <Text style={styles.sectionTitle}>Lectura del mes</Text>
            <View style={styles.contextRow}>
              <Text style={styles.contextLabel}>Clases registradas</Text>
              <Text style={styles.contextValue}>{summary?.total_registros_asistencia || 0}</Text>
            </View>
            <View style={[styles.contextRow, styles.contextBorder]}>
              <Text style={styles.contextLabel}>Asistencia mes anterior</Text>
              <Text style={styles.contextValue}>{summary?.porcentaje_asistencia_anterior || 0}%</Text>
            </View>
            <View style={[styles.contextRow, styles.contextBorder]}>
              <Text style={styles.contextLabel}>Curso</Text>
              <Text style={styles.contextValue}>{student.curso_nombre || "-"}</Text>
            </View>
          </Surface>

          <Surface>
            <Text style={styles.sectionTitle}>Eventos recientes</Text>
            {(summary?.eventos_recientes || []).length === 0 ? (
              <Text style={styles.emptyText}>No hay eventos recientes para este estudiante.</Text>
            ) : (
              (summary?.eventos_recientes || []).map((item, index) => {
                const tone = getEventTone(item.tipo);
                return (
                  <View key={`${item.tipo}-${index}`} style={[styles.eventRow, index ? styles.eventBorder : null]}>
                    <View style={[styles.eventDot, { backgroundColor: tone }]} />
                    <View style={styles.eventCopy}>
                      <Text style={styles.eventType}>{String(item.tipo || "").toUpperCase()}</Text>
                      <Text style={styles.eventDetail}>{item.fecha} - {item.detalle}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </Surface>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: theme.colors.surface,
    gap: 12,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  heroEyebrow: {
    color: theme.colors.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontSize: 11,
    fontWeight: "700",
  },
  heroValue: {
    color: theme.colors.ink,
    fontSize: 34,
    fontWeight: "700",
    marginTop: 6,
  },
  heroText: {
    color: theme.colors.inkSoft,
    lineHeight: 20,
  },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: theme.colors.ink,
    fontWeight: "700",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  stateCard: {
    backgroundColor: theme.colors.surface,
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  stateText: {
    color: theme.colors.inkSoft,
  },
  errorText: {
    color: theme.colors.danger,
    textAlign: "center",
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 4,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  retryText: {
    color: theme.colors.white,
    fontWeight: "700",
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  contextCard: {
    backgroundColor: theme.colors.surface,
    gap: 0,
  },
  sectionTitle: {
    color: theme.colors.ink,
    fontWeight: "700",
    marginBottom: 10,
    fontSize: 16,
  },
  contextRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    gap: 12,
  },
  contextBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  contextLabel: {
    color: theme.colors.inkSoft,
    fontSize: 13,
  },
  contextValue: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "700",
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
  emptyText: {
    color: theme.colors.inkSoft,
    lineHeight: 19,
  },
  cacheText: {
    color: theme.colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
    textAlign: "right",
  },
});
