import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import { ActionCard, Surface } from "../components/Cards";
import { mobileApi } from "../api/client";
import { theme } from "../theme";
import { readCache, writeCache } from "../utils/cache";

export default function LateArrivalsScreen({ route, navigation }) {
  const { student } = route.params;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cachedAt, setCachedAt] = useState("");

  const openRequest = () => {
    navigation.getParent()?.navigate("Solicitudes", {
      screen: "RequestJustification",
      params: { student, atraso: rows[0] || null },
    });
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      const cacheKey = `late_arrivals_${student.id}`;
      const cached = await readCache(cacheKey);

      if (cached?.value) {
        setRows(cached.value);
        setCachedAt(cached.savedAt || "");
      }

      try {
        const { data } = await mobileApi.get(`/apoderados/estudiantes/${student.id}/atrasos`);
        const nextRows = data || [];
        setRows(nextRows);
        setCachedAt(new Date().toISOString());
        await writeCache(cacheKey, nextRows);
      } catch (err) {
        if (!cached?.value) {
          setRows([]);
          setError(err?.response?.data?.error || err.message || "No se pudieron cargar los atrasos.");
        } else {
          setError("Mostrando el ultimo historial guardado.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [student.id]);

  return (
    <Screen eyebrow="Atrasos" title={`Historial de ${student.nombre}`} subtitle="Revisa minutos de retraso y justifica rapido si hace falta.">
      <ActionCard title="Enviar justificacion" subtitle="Adjunta una foto y explica el motivo del atraso." accent={theme.colors.warning} onPress={openRequest} />

      {error ? (
        <Surface>
          <Text style={styles.infoTitle}>Sincronizacion parcial</Text>
          <Text style={styles.infoText}>{error}</Text>
        </Surface>
      ) : null}

      {cachedAt ? <Text style={styles.cacheText}>Ultima sincronizacion: {cachedAt.slice(0, 16).replace("T", " ")}</Text> : null}

      {loading && !rows.length ? (
        <Surface style={styles.stateCard}>
          <ActivityIndicator color={theme.colors.warning} />
          <Text style={styles.infoText}>Cargando atrasos...</Text>
        </Surface>
      ) : null}

      {!loading && rows.length === 0 ? (
        <Surface>
          <Text style={styles.infoTitle}>Sin atrasos registrados</Text>
          <Text style={styles.infoText}>Este estudiante no tiene atrasos cargados por ahora.</Text>
        </Surface>
      ) : null}

      {(rows || []).map((row) => (
        <Surface key={row.id}>
          <View style={styles.rowTop}>
            <Text style={styles.date}>{row.fecha}</Text>
            <View style={[styles.statusPill, row.justificado ? styles.statusDone : styles.statusPending]}>
              <Text style={[styles.statusText, row.justificado ? styles.statusDoneText : styles.statusPendingText]}>{row.justificado ? "Justificado" : "Pendiente"}</Text>
            </View>
          </View>
          <Text style={styles.detail}>{row.hora_ingreso} - {row.minutos_retraso} min de retraso</Text>
        </Surface>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  date: {
    color: theme.colors.ink,
    fontWeight: "800",
  },
  detail: {
    color: theme.colors.inkSoft,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusDone: {
    backgroundColor: "#e6f8ee",
  },
  statusPending: {
    backgroundColor: "#fff3db",
  },
  statusText: {
    fontWeight: "800",
    fontSize: 12,
  },
  statusDoneText: {
    color: theme.colors.success,
  },
  statusPendingText: {
    color: theme.colors.warning,
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
