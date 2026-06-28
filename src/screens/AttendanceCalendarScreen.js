import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Calendar } from "react-native-calendars";
import Screen from "../components/Screen";
import { Surface } from "../components/Cards";
import { mobileApi } from "../api/client";
import { theme } from "../theme";
import { readCache, writeCache } from "../utils/cache";

const COLORS = {
  presente: "#18b981",
  ausente: "#94a3b8",
  justificado: "#3b82f6",
  sinRegistro: "#e2e8f0",
};

function getAttendanceTone(day) {
  const state = String(day?.estado || day?.estado_asistencia || "").toLowerCase();

  if (state === "ausente") return COLORS.ausente;
  if (state === "justificado") return COLORS.justificado;
  if (state === "presente") return COLORS.presente;

  return COLORS.sinRegistro;
}

function getLegendItems() {
  return [
    { label: "presente", color: COLORS.presente },
    { label: "ausente", color: COLORS.ausente },
    { label: "justificado", color: COLORS.justificado },
  ];
}

export default function AttendanceCalendarScreen({ route }) {
  const student = route?.params?.student;
  const [calendar, setCalendar] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [monthlyCards, setMonthlyCards] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cachedAt, setCachedAt] = useState("");

  useEffect(() => {
    if (!student?.id) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setError("");

      const cacheKey = `attendance_calendar_${student.id}`;
      const cached = await readCache(cacheKey);

      if (cached?.value?.dias) {
        setCalendar(cached.value);
        setCachedAt(cached.savedAt || "");
        const cachedFirst = cached.value.dias.find((day) => day.estado_asistencia) || cached.value.dias[0] || null;
        setSelectedDate(cachedFirst?.fecha || "");
      }

      try {
        const attendanceRes = await mobileApi.get(`/apoderados/estudiantes/${student.id}/asistencia-mensual`);
        const [summaryRes, annotationsRes, exitsRes] = await Promise.allSettled([
          mobileApi.get(`/apoderados/estudiantes/${student.id}/resumen`),
          mobileApi.get(`/apoderados/estudiantes/${student.id}/anotaciones`),
          mobileApi.get(`/apoderados/estudiantes/${student.id}/salidas`),
        ]);

        const data = attendanceRes.data;
        setCalendar(data || null);
        const firstDay = (data?.dias || []).find((day) => day.estado_asistencia) || data?.dias?.[0] || null;
        setSelectedDate(firstDay?.fecha || "");
        setMonthlyCards({
          atrasos: Number(summaryRes.status === "fulfilled" ? summaryRes.value?.data?.total_atrasos_mes || 0 : 0),
          promedio_retraso: Number(summaryRes.status === "fulfilled" ? summaryRes.value?.data?.promedio_minutos_retraso || 0 : 0),
          anotaciones: annotationsRes.status === "fulfilled" && Array.isArray(annotationsRes.value?.data) ? annotationsRes.value.data.length : 0,
          salidas: exitsRes.status === "fulfilled" && Array.isArray(exitsRes.value?.data) ? exitsRes.value.data.length : 0,
          ausencias: Number(summaryRes.status === "fulfilled" ? summaryRes.value?.data?.total_ausencias_mes || 0 : 0),
        });
        setCachedAt(new Date().toISOString());
        await writeCache(cacheKey, data || null);
      } catch (err) {
        if (!cached?.value?.dias) {
          setCalendar(null);
          setError(err?.response?.data?.error || err.message || "No se pudo cargar el calendario.");
        } else {
          setError("Mostrando el ultimo calendario guardado.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [student?.id]);

  const dayLookup = useMemo(() => new Map((calendar?.dias || []).map((day) => [day.fecha, day])), [calendar]);

  const monthlyMetrics = monthlyCards || {
    atrasos: 0,
    promedio_retraso: 0,
    anotaciones: 0,
    salidas: 0,
    ausencias: 0,
  };

  const renderDay = ({ date, state }) => {
    const day = dayLookup.get(date.dateString);
    const tone = day ? getAttendanceTone(day) : COLORS.sinRegistro;
    const isSelected = selectedDate === date.dateString;
    const textColor = tone === COLORS.sinRegistro ? theme.colors.ink : theme.colors.white;

    return (
      <Pressable
        onPress={() => setSelectedDate(date.dateString)}
        style={[
          styles.dayCell,
          {
            backgroundColor: tone,
            opacity: state === "disabled" ? 0.25 : 1,
            transform: isSelected ? [{ scale: 1.02 }] : [{ scale: 1 }],
            borderColor: isSelected ? theme.colors.ink : tone,
          },
        ]}
      >
        <Text style={[styles.dayNumber, { color: textColor }]}>{date.day}</Text>
      </Pressable>
    );
  };

  if (!student) {
    return (
      <Screen eyebrow="Calendario" title="Calendario no disponible" subtitle="Vuelve al inicio y elige un estudiante.">
        <Surface>
          <Text style={styles.infoText}>Faltan datos del estudiante para mostrar el calendario.</Text>
        </Surface>
      </Screen>
    );
  }

  return (
    <Screen eyebrow="Calendario" title={`Mes de ${student.nombre}`} subtitle="Una vista mensual mucho mas clara para detectar patrones de asistencia.">
      {error ? (
        <Surface>
          <Text style={styles.infoTitle}>Sincronizacion parcial</Text>
          <Text style={styles.infoText}>{error}</Text>
        </Surface>
      ) : null}

      {cachedAt ? <Text style={styles.cacheText}>Ultima sincronizacion: {cachedAt.slice(0, 16).replace("T", " ")}</Text> : null}

      <Surface style={styles.calendarCard}>
        {loading && !calendar?.dias?.length ? (
          <View style={styles.stateRow}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text style={styles.infoText}>Cargando calendario...</Text>
          </View>
        ) : calendar?.dias?.length ? (
          <Calendar
            current={calendar?.mes ? `${calendar.mes}-01` : undefined}
            markingType="custom"
            dayComponent={renderDay}
            theme={{
              calendarBackground: theme.colors.surface,
              backgroundColor: theme.colors.surface,
              monthTextColor: theme.colors.ink,
              textMonthFontWeight: "800",
              textDayHeaderFontWeight: "700",
              textSectionTitleColor: theme.colors.inkMuted,
              arrowColor: theme.colors.ink,
            }}
          />
        ) : (
          <Text style={styles.infoText}>Todavia no hay eventos registrados para este mes.</Text>
        )}
      </Surface>

      <Surface style={styles.legendCard}>
        <Text style={styles.sectionTitle}>Leyenda</Text>
        <View style={styles.legendGrid}>
          {getLegendItems().map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </View>
      </Surface>

      <Surface>
        <Text style={styles.sectionTitle}>Resumen del mes</Text>
        <View style={styles.cardsGrid}>
          <MetricPill label="Anotaciones" value={monthlyMetrics.anotaciones} tone={theme.colors.accent} />
          <MetricPill label="Atrasos" value={monthlyMetrics.atrasos} tone={theme.colors.warning} />
          <MetricPill label="Ausencias" value={monthlyMetrics.ausencias} tone={theme.colors.danger} />
          <MetricPill label="Salidas" value={monthlyMetrics.salidas} tone={theme.colors.ink} />
          <MetricPill label="Prom. retraso" value={`${monthlyMetrics.promedio_retraso} min`} tone={theme.colors.inkSoft} />
        </View>
      </Surface>
    </Screen>
  );
}

function MetricPill({ label, value, tone }) {
  return (
    <View style={styles.metricPill}>
      <Text style={[styles.metricLabel, { color: tone }]}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  calendarCard: {
    paddingVertical: 14,
  },
  legendCard: {
    gap: 10,
  },
  sectionTitle: {
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 16,
  },
  legendGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceAlt,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  legendText: {
    color: theme.colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  cardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricPill: {
    minWidth: 110,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  metricValue: {
    color: theme.colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4,
  },
  dayCell: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    margin: 3,
  },
  dayNumber: {
    color: theme.colors.white,
    fontSize: 13,
    fontWeight: "800",
  },
  infoTitle: {
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 16,
    marginBottom: 6,
  },
  infoText: {
    color: theme.colors.inkSoft,
    lineHeight: 20,
  },
  cacheText: {
    color: theme.colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  stateRow: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
});
