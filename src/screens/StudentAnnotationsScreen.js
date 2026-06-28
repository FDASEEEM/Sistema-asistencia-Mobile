import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import { Surface } from "../components/Cards";
import { mobileApi } from "../api/client";
import { theme } from "../theme";
import { readCache, writeCache } from "../utils/cache";

function getTone(item) {
  if (item.gravedad === "alta") return theme.colors.danger;
  if (item.gravedad === "baja") return theme.colors.success;
  return theme.colors.accent;
}

export default function StudentAnnotationsScreen({ route }) {
  const { student } = route.params;
  const [annotations, setAnnotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cachedAt, setCachedAt] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      const cacheKey = `annotations_${student.id}`;
      const cached = await readCache(cacheKey);

      if (cached?.value?.length) {
        setAnnotations(cached.value);
        setCachedAt(cached.savedAt || "");
      }

      try {
        const { data } = await mobileApi.get(`/apoderados/estudiantes/${student.id}/anotaciones`);
        setAnnotations(data || []);
        setCachedAt(new Date().toISOString());
        await writeCache(cacheKey, data || []);
      } catch (err) {
        if (!cached?.value?.length) {
          setAnnotations([]);
          setError(err?.response?.data?.error || err.message || "No se pudieron cargar las anotaciones.");
        } else {
          setError("Mostrando las ultimas anotaciones guardadas.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [student.id]);

  return (
    <Screen eyebrow="Disciplina" title={`Anotaciones de ${student.nombre}`} subtitle="Revisa observaciones, felicitaciones y seguimientos visibles para apoderados.">
      <Surface>
        <Text style={styles.metaLabel}>Curso</Text>
        <Text style={styles.metaValue}>{student.curso_nombre || student.curso?.nombre || "-"}</Text>
        <Text style={[styles.metaLabel, styles.spaced]}>Profesor jefe</Text>
        <Text style={styles.metaValue}>
          {student.curso?.profesor_jefe
            ? `${student.curso.profesor_jefe.nombre} ${student.curso.profesor_jefe.apellido}`
            : "Sin asignar"}
        </Text>
        {student.curso?.profesor_jefe?.email ? <Text style={styles.metaSub}>{student.curso.profesor_jefe.email}</Text> : null}
      </Surface>

      {error ? (
        <Surface>
          <Text style={styles.infoTitle}>Sincronizacion parcial</Text>
          <Text style={styles.infoText}>{error}</Text>
        </Surface>
      ) : null}

      {cachedAt ? <Text style={styles.cacheText}>Ultima sincronizacion: {cachedAt.slice(0, 16).replace("T", " ")}</Text> : null}

      {loading && !annotations.length ? (
        <Surface style={styles.stateCard}>
          <ActivityIndicator color={theme.colors.accent} />
          <Text style={styles.infoText}>Cargando anotaciones...</Text>
        </Surface>
      ) : annotations.length ? (
        annotations.map((item) => (
          <Surface key={item.id} style={styles.card}>
            <View style={styles.rowTop}>
              <View style={[styles.badge, { borderColor: getTone(item) }]}>
                <Text style={[styles.badgeText, { color: getTone(item) }]}>{item.tipo}</Text>
              </View>
              <Text style={styles.date}>{item.fecha}</Text>
            </View>
            <Text style={styles.title}>{item.titulo}</Text>
            <Text style={styles.detail}>{item.descripcion}</Text>
            <Text style={[styles.gravity, { color: getTone(item) }]}>Gravedad: {item.gravedad}</Text>
          </Surface>
        ))
      ) : (
        <Surface>
          <Text style={styles.infoText}>Todavia no hay anotaciones visibles para este estudiante.</Text>
        </Surface>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  metaLabel: {
    color: theme.colors.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontSize: 11,
    fontWeight: "700",
  },
  metaValue: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4,
  },
  metaSub: {
    color: theme.colors.inkSoft,
    marginTop: 4,
  },
  spaced: {
    marginTop: 14,
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
    minHeight: 100,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  card: {
    gap: 10,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  badge: {
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: theme.colors.surfaceAlt,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  date: {
    color: theme.colors.inkMuted,
    fontSize: 12,
  },
  title: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  detail: {
    color: theme.colors.inkSoft,
    lineHeight: 20,
  },
  gravity: {
    fontWeight: "700",
  },
});
