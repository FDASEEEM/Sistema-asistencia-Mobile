import React, { useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import { ActionCard, MetricCard, Surface } from "../components/Cards";
import { mobileApi } from "../api/client";
import { theme } from "../theme";
import { useAuth } from "../context/AuthContext";
import { readCache, writeCache } from "../utils/cache";

function getSummaryState(summary) {
  if (!summary) {
    return { label: "Sin datos", tone: theme.colors.inkMuted };
  }

  if (summary.estado_resumen === "excelente") {
    return { label: "Mes solido", tone: theme.colors.success };
  }

  if (summary.estado_resumen === "estable") {
    return { label: "Seguimiento estable", tone: theme.colors.accent };
  }

  return { label: "Requiere atencion", tone: theme.colors.warning };
}

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [favoriteId, setFavoriteId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [studentsCachedAt, setStudentsCachedAt] = useState("");
  const [summaryCachedAt, setSummaryCachedAt] = useState("");
  const [comparisonRows, setComparisonRows] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setStudentsLoading(true);
      const cached = await readCache("students_list");
      const savedId = await SecureStore.getItemAsync("last_student_id");
      const favoriteStudentId = await SecureStore.getItemAsync("favorite_student_id");
      setFavoriteId(favoriteStudentId ? Number(favoriteStudentId) : null);

      if (cached?.value?.length) {
        setStudents(cached.value);
        setStudentsCachedAt(cached.savedAt || "");
        const cachedChoice =
          cached.value.find((item) => String(item.id) === String(savedId)) ||
          cached.value.find((item) => String(item.id) === String(favoriteStudentId)) ||
          cached.value[0] ||
          null;
        setSelected(cachedChoice);
      }

      try {
        const { data } = await mobileApi.get("/apoderados/estudiantes");
        const nextStudents = data || [];
        setStudents(nextStudents);
        await writeCache("students_list", nextStudents);
        setStudentsCachedAt(new Date().toISOString());
        const chosen =
          nextStudents.find((item) => String(item.id) === String(savedId)) ||
          nextStudents.find((item) => String(item.id) === String(favoriteStudentId)) ||
          nextStudents[0] ||
          null;
        setSelected(chosen);
      } catch (err) { console.warn('[HomeScreen] load students error:', err); }
      finally {
        setStudentsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selected?.id) {
      setSummary(null);
      return;
    }

    let active = true;

    (async () => {
      setSummaryLoading(true);
      setSummaryError("");
      const cacheKey = `summary_${selected.id}`;

      const cached = await readCache(cacheKey);
      if (active && cached?.value) {
        setSummary(cached.value);
        setSummaryCachedAt(cached.savedAt || "");
      }

      try {
        const { data } = await mobileApi.get(`/apoderados/estudiantes/${selected.id}/resumen`);
        if (active) {
          setSummary(data);
          setSummaryCachedAt(new Date().toISOString());
        }
        await writeCache(cacheKey, data);
      } catch (err) {
        console.warn('[HomeScreen] load summary error:', err);
        if (active) {
          setSummaryError(cached?.value ? "Mostrando el ultimo resumen guardado." : "No pude cargar el resumen del estudiante.");
        }
      } finally {
        if (active) {
          setSummaryLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [selected?.id]);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!students.length) {
        setComparisonRows([]);
        return;
      }

      const cachedRows = await Promise.all(
        students.map(async (student) => {
          const cached = await readCache(`summary_${student.id}`);
          return cached?.value
            ? {
                id: student.id,
                nombre: `${student.nombre} ${student.apellido}`,
                porcentaje: cached.value.porcentaje_asistencia || 0,
                estado: cached.value.estado_resumen || "sin-datos",
              }
            : null;
        }),
      );

      const compactRows = cachedRows.filter(Boolean).sort((a, b) => b.porcentaje - a.porcentaje);
      if (active) {
        setComparisonRows(compactRows.slice(0, 4));
      }
    })();

    return () => {
      active = false;
    };
  }, [students, summary]);

  const choose = async (student) => {
    setSelected(student);
    await SecureStore.setItemAsync("last_student_id", String(student.id));
  };

  const toggleFavorite = async (studentId) => {
    const nextValue = favoriteId === studentId ? null : studentId;
    setFavoriteId(nextValue);
    if (nextValue) {
      await SecureStore.setItemAsync("favorite_student_id", String(nextValue));
    } else {
      await SecureStore.deleteItemAsync("favorite_student_id");
    }
  };

  const initials = useMemo(() => {
    const name = user?.nombre?.[0] || "";
    const last = user?.apellido?.[0] || "";
    return `${name}${last}`.trim() || "AP";
  }, [user]);
  const summaryState = useMemo(() => getSummaryState(summary), [summary]);

  return (
    <Screen
      eyebrow="Inicio"
      title="Tus estudiantes"
      subtitle="Entra rapido al alumno correcto y revisa lo importante sin perderte en menus."
      right={
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      }
    >
      <Surface style={styles.welcomeCard}>
        <View style={styles.welcomeTop}>
          <View>
            <Text style={styles.welcomeEyebrow}>Cuenta activa</Text>
            <Text style={styles.welcomeTitle}>{user ? `${user.nombre} ${user.apellido}` : "Apoderado"}</Text>
          </View>
          <MaterialCommunityIcons name="shield-check-outline" size={22} color={theme.colors.inkSoft} />
        </View>
        <Text style={styles.welcomeText}>Todo el seguimiento del estudiante vive aqui: asistencia, atrasos, salidas y solicitudes.</Text>
      </Surface>

      <Surface style={styles.selectorCard}>
        <Text style={styles.selectorLabel}>Cambiar estudiante</Text>
        {studentsLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text style={styles.loadingText}>Cargando estudiantes...</Text>
          </View>
        ) : null}
        <View style={styles.pills}>
          {students.map((student) => (
            <View key={student.id} style={styles.pillRow}>
              <Pressable onPress={() => choose(student)} style={[styles.pill, selected?.id === student.id && styles.pillActive]}>
                <Text style={[styles.pillText, selected?.id === student.id && styles.pillTextActive]}>
                  {student.nombre} {student.apellido}
                </Text>
              </Pressable>
              <Pressable onPress={() => toggleFavorite(student.id)} style={styles.favoriteButton}>
                <MaterialCommunityIcons
                  name={favoriteId === student.id ? "star" : "star-outline"}
                  size={18}
                  color={favoriteId === student.id ? theme.colors.warning : theme.colors.inkMuted}
                />
              </Pressable>
            </View>
          ))}
        </View>
      </Surface>

      {comparisonRows.length ? (
        <Surface style={styles.compareCard}>
          <View style={styles.compareTop}>
            <Text style={styles.compareTitle}>Comparativo rapido</Text>
            <Text style={styles.compareMeta}>Asistencia del mes</Text>
          </View>
          {comparisonRows.slice(0, 4).map((row, index) => (
            <View key={row.id} style={[styles.compareRow, index ? styles.compareBorder : null]}>
              <Text style={styles.compareName}>{row.nombre}</Text>
              <View style={styles.compareRight}>
                <Text style={styles.compareValue}>{row.porcentaje}%</Text>
                {favoriteId === row.id ? <MaterialCommunityIcons name="star" size={14} color={theme.colors.warning} /> : null}
              </View>
            </View>
          ))}
        </Surface>
      ) : null}

      {selected ? (
        <>
          <Surface style={styles.studentCard}>
            <View style={styles.studentTop}>
              <View>
                <Text style={styles.studentEyebrow}>Estudiante seleccionado</Text>
                <Text style={styles.studentName}>
                  {selected.nombre} {selected.apellido}
                </Text>
              </View>
              <View style={styles.studentIconWrap}>
                <MaterialCommunityIcons name="account-school-outline" size={24} color={theme.colors.white} />
              </View>
            </View>
            <Text style={styles.studentCourse}>{selected.curso_nombre}</Text>
            {selected.curso?.profesor_jefe ? (
              <Text style={styles.teacherInfo}>
                Profesor jefe: {selected.curso.profesor_jefe.nombre} {selected.curso.profesor_jefe.apellido}
                {selected.curso.profesor_jefe.email ? ` · ${selected.curso.profesor_jefe.email}` : ""}
              </Text>
            ) : null}
          </Surface>

          <Surface style={styles.overviewCard}>
            <View style={styles.overviewTop}>
              <View>
                <Text style={styles.overviewEyebrow}>Panorama del mes</Text>
                <Text style={styles.overviewTitle}>Resumen rapido</Text>
              </View>
              <View style={[styles.overviewBadge, { borderColor: summaryState.tone }]}>
                <Text style={[styles.overviewBadgeText, { color: summaryState.tone }]}>{summaryState.label}</Text>
              </View>
            </View>

            {summaryLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={theme.colors.accent} />
                <Text style={styles.loadingText}>Actualizando indicadores...</Text>
              </View>
            ) : summaryError ? (
              <Text style={styles.errorText}>{summaryError}</Text>
            ) : summary ? (
              <>
                <View style={styles.metrics}>
                  <MetricCard label="Asistencia" value={`${summary.porcentaje_asistencia}%`} tone={theme.colors.ink} />
                  <MetricCard label="Ausencias" value={summary.total_ausencias_mes || 0} tone={theme.colors.danger} />
                  <MetricCard label="Atrasos" value={summary.total_atrasos_mes || 0} tone={theme.colors.warning} />
                  <MetricCard label="Tendencia" value={`${summary.delta_asistencia > 0 ? "+" : ""}${summary.delta_asistencia || 0}%`} tone={summary.delta_asistencia >= 0 ? theme.colors.success : theme.colors.danger} />
                </View>
                <Text style={styles.overviewFoot}>
                  {summary.total_registros_asistencia || 0} clases registradas este mes para {selected.nombre}.
                </Text>
                {summaryCachedAt ? <Text style={styles.cacheText}>Ultima sincronizacion: {summaryCachedAt.slice(0, 16).replace("T", " ")}</Text> : null}
              </>
            ) : (
              <Text style={styles.loadingText}>Aun no hay datos disponibles para este estudiante.</Text>
            )}
          </Surface>

          <ActionCard icon="view-dashboard-outline" title="Abrir resumen" subtitle="Indicadores y eventos recientes en una vista limpia." onPress={() => navigation.navigate("StudentSummary", { student: selected })} />
          <ActionCard icon="calendar-month-outline" title="Calendario mensual" subtitle="Asistencia del mes, dia por dia, con estados claros." accent={theme.colors.accent} onPress={() => navigation.navigate("AttendanceCalendar", { student: selected })} />
          <ActionCard icon="clock-alert-outline" title="Atrasos" subtitle="Minutos de retraso, estado y envio de justificacion." accent={theme.colors.warning} onPress={() => navigation.navigate("LateArrivals", { student: selected })} />
          <ActionCard icon="exit-run" title="Salidas" subtitle="Historial y nuevas solicitudes de retiro." accent={theme.colors.danger} onPress={() => navigation.navigate("EarlyExits", { student: selected })} />
          <ActionCard icon="note-text-outline" title="Anotaciones" subtitle="Observaciones y seguimientos visibles para apoderados." accent={theme.colors.accent} onPress={() => navigation.navigate("StudentAnnotations", { student: selected })} />
        </>
      ) : null}

      {!selected && studentsLoading ? (
        <Surface style={styles.stateCard}>
          <ActivityIndicator color={theme.colors.accent} />
          <Text style={styles.loadingText}>Preparando Inicio...</Text>
        </Surface>
      ) : null}

      {!students.length && studentsCachedAt ? <Text style={styles.cacheText}>Ultima lista guardada: {studentsCachedAt.slice(0, 16).replace("T", " ")}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: theme.colors.ink,
    fontWeight: "700",
  },
  welcomeCard: {
    backgroundColor: theme.colors.surface,
  },
  welcomeTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  welcomeEyebrow: {
    color: theme.colors.inkSoft,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "700",
  },
  welcomeTitle: {
    color: theme.colors.ink,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 5,
  },
  welcomeText: {
    color: theme.colors.inkSoft,
    lineHeight: 21,
  },
  selectorCard: {
    backgroundColor: theme.colors.surface,
  },
  selectorLabel: {
    color: theme.colors.ink,
    fontWeight: "700",
  },
  pills: {
    gap: 8,
  },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pill: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pillActive: {
    backgroundColor: theme.colors.ink,
    borderColor: theme.colors.ink,
  },
  pillText: {
    color: theme.colors.ink,
    fontWeight: "700",
  },
  pillTextActive: {
    color: theme.colors.white,
  },
  favoriteButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  compareCard: {
    backgroundColor: theme.colors.surface,
    gap: 0,
  },
  compareTop: {
    marginBottom: 8,
  },
  compareTitle: {
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 16,
  },
  compareMeta: {
    color: theme.colors.inkSoft,
    marginTop: 4,
    fontSize: 12,
  },
  compareRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 11,
  },
  compareBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  compareName: {
    color: theme.colors.ink,
    fontWeight: "700",
    flex: 1,
  },
  compareRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  compareValue: {
    color: theme.colors.ink,
    fontWeight: "800",
  },
  studentCard: {
    backgroundColor: theme.colors.surface,
    gap: 12,
  },
  studentTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  studentEyebrow: {
    color: theme.colors.inkSoft,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "700",
  },
  studentName: {
    color: theme.colors.ink,
    fontSize: 23,
    fontWeight: "700",
    marginTop: 6,
  },
  studentCourse: {
    color: theme.colors.inkSoft,
    fontSize: 15,
  },
  teacherInfo: {
    color: theme.colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  studentIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  overviewCard: {
    backgroundColor: theme.colors.surface,
    gap: 14,
  },
  overviewTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  overviewEyebrow: {
    color: theme.colors.inkSoft,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "700",
  },
  overviewTitle: {
    color: theme.colors.ink,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 5,
  },
  overviewBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    backgroundColor: theme.colors.surfaceAlt,
  },
  overviewBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  overviewFoot: {
    color: theme.colors.inkSoft,
    lineHeight: 19,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 70,
  },
  loadingText: {
    color: theme.colors.inkSoft,
    lineHeight: 19,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  stateCard: {
    alignItems: "center",
    gap: 10,
  },
  errorText: {
    color: theme.colors.danger,
    lineHeight: 19,
  },
  cacheText: {
    color: theme.colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
