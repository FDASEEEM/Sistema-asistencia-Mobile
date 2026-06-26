import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import { Surface } from "../components/Cards";
import { mobileApi } from "../api/client";
import { theme } from "../theme";
import { readCache, writeCache } from "../utils/cache";

function StatusPill({ status }) {
  const normalized = String(status || "").toLowerCase();
  const styleMap = {
    pendiente: { bg: "#fff4d6", fg: "#a16207" },
    aprobada: { bg: "#e8f8ee", fg: "#15803d" },
    rechazada: { bg: "#ffe4e6", fg: "#be123c" },
  };
  const colors = styleMap[normalized] || { bg: "#eef2ff", fg: "#4338ca" };
  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }]}>
      <Text style={[styles.pillText, { color: colors.fg }]}>{status}</Text>
    </View>
  );
}

const STATUS_FILTERS = [
  { id: "todos", label: "Todos" },
  { id: "pendiente", label: "Pendientes" },
  { id: "aprobada", label: "Aprobadas" },
  { id: "rechazada", label: "Rechazadas" },
];

export default function RequestsScreen({ navigation }) {
  const [justificaciones, setJustificaciones] = useState([]);
  const [salidas, setSalidas] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cachedAt, setCachedAt] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");

      const [cachedJustificaciones, cachedSalidas, cachedStudents] = await Promise.all([
        readCache("requests_justificaciones"),
        readCache("requests_salidas"),
        readCache("students_list"),
      ]);

      if (cachedJustificaciones?.value) {
        setJustificaciones(cachedJustificaciones.value);
      }
      if (cachedSalidas?.value) {
        setSalidas(cachedSalidas.value);
      }
      if (cachedStudents?.value) {
        setStudents(cachedStudents.value);
      }
      setCachedAt(cachedJustificaciones?.savedAt || cachedSalidas?.savedAt || cachedStudents?.savedAt || "");

      try {
        const [{ data: j }, { data: s }, { data: st }] = await Promise.all([
          mobileApi.get("/apoderados/solicitudes/justificacion"),
          mobileApi.get("/apoderados/solicitudes/salida"),
          mobileApi.get("/apoderados/estudiantes"),
        ]);

        const nextJustificaciones = j || [];
        const nextSalidas = s || [];
        const nextStudents = st || [];
        setJustificaciones(nextJustificaciones);
        setSalidas(nextSalidas);
        setStudents(nextStudents);
        setCachedAt(new Date().toISOString());
        await Promise.all([
          writeCache("requests_justificaciones", nextJustificaciones),
          writeCache("requests_salidas", nextSalidas),
          writeCache("students_list", nextStudents),
        ]);
      } catch (err) {
        const hasCached = Boolean(cachedJustificaciones?.value || cachedSalidas?.value || cachedStudents?.value);
        if (!hasCached) {
          setJustificaciones([]);
          setSalidas([]);
          setStudents([]);
        }
        setError(hasCached ? "Mostrando el ultimo historial guardado." : err?.response?.data?.error || err.message || "No se pudieron cargar las solicitudes.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredJustificaciones = useMemo(() => {
    if (statusFilter === "todos") {
      return justificaciones;
    }
    return justificaciones.filter((item) => String(item.estado || "").toLowerCase() === statusFilter);
  }, [justificaciones, statusFilter]);

  const filteredSalidas = useMemo(() => {
    if (statusFilter === "todos") {
      return salidas;
    }
    return salidas.filter((item) => String(item.estado || "").toLowerCase() === statusFilter);
  }, [salidas, statusFilter]);

  const total = useMemo(() => justificaciones.length + salidas.length, [justificaciones.length, salidas.length]);
  const pendingTotal = useMemo(
    () =>
      justificaciones.filter((item) => String(item.estado || "").toLowerCase() === "pendiente").length +
      salidas.filter((item) => String(item.estado || "").toLowerCase() === "pendiente").length,
    [justificaciones, salidas],
  );

  const defaultStudent = students[0] || null;

  const openJustification = () => {
    if (!defaultStudent) {
      return;
    }
    navigation.navigate("RequestJustification", { student: defaultStudent, atraso: null });
  };

  const openEarlyExit = () => {
    if (!defaultStudent) {
      return;
    }
    navigation.navigate("RequestEarlyExit", { student: defaultStudent });
  };

  return (
    <Screen eyebrow="Seguimiento" title="Solicitudes" subtitle="Revisa el historial de justificaciones y salidas, con su estado actual.">
      <Surface>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.kicker}>Resumen</Text>
            <Text style={styles.total}>{total} solicitudes</Text>
            <Text style={styles.subtotal}>{pendingTotal} pendientes de respuesta</Text>
          </View>
          <View style={styles.quickActions}>
            <Pressable style={[styles.ghostButton, !defaultStudent && styles.disabledButton]} onPress={openJustification} disabled={!defaultStudent}>
              <Text style={styles.ghostButtonText}>Justificar</Text>
            </Pressable>
            <Pressable style={[styles.primaryButton, !defaultStudent && styles.disabledButton]} onPress={openEarlyExit} disabled={!defaultStudent}>
              <Text style={styles.primaryButtonText}>Salida</Text>
            </Pressable>
          </View>
        </View>
        {!defaultStudent ? <Text style={styles.helperText}>Necesitas al menos un estudiante vinculado para crear nuevas solicitudes.</Text> : null}
      </Surface>

      <Surface>
        <Text style={styles.sectionTitle}>Filtrar por estado</Text>
        <View style={styles.filterRow}>
          {STATUS_FILTERS.map((filter) => (
            <Pressable key={filter.id} onPress={() => setStatusFilter(filter.id)} style={[styles.filterChip, statusFilter === filter.id && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, statusFilter === filter.id && styles.filterChipTextActive]}>{filter.label}</Text>
            </Pressable>
          ))}
        </View>
      </Surface>

      {error ? (
        <Surface>
          <Text style={styles.infoTitle}>Sincronizacion parcial</Text>
          <Text style={styles.infoText}>{error}</Text>
        </Surface>
      ) : null}

      {cachedAt ? <Text style={styles.cacheText}>Ultima sincronizacion: {cachedAt.slice(0, 16).replace("T", " ")}</Text> : null}

      {loading && !total ? (
        <Surface style={styles.stateCard}>
          <ActivityIndicator color={theme.colors.accent} />
          <Text style={styles.infoText}>Cargando solicitudes...</Text>
        </Surface>
      ) : null}

      <Surface>
        <Text style={styles.sectionTitle}>Justificaciones</Text>
        {filteredJustificaciones.length === 0 ? (
          <Text style={styles.empty}>No hay justificaciones para este filtro.</Text>
        ) : (
          filteredJustificaciones.map((item) => (
            <View key={`j-${item.id}`} style={styles.row}>
              <View style={styles.rowTop}>
                <Text style={styles.name}>
                  {item.apellido}, {item.nombre}
                </Text>
                <StatusPill status={item.estado} />
              </View>
              <Text style={styles.meta}>{item.creado_en?.slice(0, 10)}</Text>
              <Text style={styles.detail} numberOfLines={2}>
                {item.motivo}
              </Text>
              {item.comentario_revision ? <Text style={styles.review}>Revision: {item.comentario_revision}</Text> : null}
              {item.evidencia_url ? <Text style={styles.evidence}>Evidencia adjunta</Text> : null}
            </View>
          ))
        )}
      </Surface>

      <Surface>
        <Text style={styles.sectionTitle}>Salidas</Text>
        {filteredSalidas.length === 0 ? (
          <Text style={styles.empty}>No hay solicitudes de salida para este filtro.</Text>
        ) : (
          filteredSalidas.map((item) => (
            <View key={`s-${item.id}`} style={styles.row}>
              <View style={styles.rowTop}>
                <Text style={styles.name}>
                  {item.apellido}, {item.nombre}
                </Text>
                <StatusPill status={item.estado} />
              </View>
              <Text style={styles.meta}>
                {item.fecha} - {item.hora_salida}
              </Text>
              <Text style={styles.detail} numberOfLines={2}>
                {item.motivo}
              </Text>
              {item.comentario_revision ? <Text style={styles.review}>Revision: {item.comentario_revision}</Text> : null}
            </View>
          ))
        )}
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontWeight: "800",
    marginBottom: 8,
    color: theme.colors.ink,
    fontSize: 16,
  },
  headerRow: {
    gap: 14,
  },
  kicker: {
    color: theme.colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  total: {
    color: theme.colors.ink,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 4,
  },
  subtotal: {
    color: theme.colors.inkSoft,
    marginTop: 4,
  },
  quickActions: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  ghostButton: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  ghostButtonText: {
    color: theme.colors.ink,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.55,
  },
  helperText: {
    color: theme.colors.inkSoft,
    lineHeight: 19,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.ink,
    borderColor: theme.colors.ink,
  },
  filterChipText: {
    color: theme.colors.ink,
    fontWeight: "700",
    fontSize: 12,
  },
  filterChipTextActive: {
    color: theme.colors.white,
  },
  row: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  empty: {
    color: theme.colors.inkSoft,
    paddingVertical: 8,
  },
  name: {
    color: theme.colors.ink,
    fontWeight: "700",
    flex: 1,
  },
  meta: {
    color: theme.colors.inkSoft,
    marginTop: 4,
  },
  detail: {
    color: theme.colors.ink,
    marginTop: 8,
    lineHeight: 20,
  },
  review: {
    color: theme.colors.inkSoft,
    marginTop: 8,
    lineHeight: 18,
  },
  evidence: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#e8f1ff",
    color: theme.colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "700",
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "capitalize",
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
  stateCard: {
    minHeight: 92,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
});
