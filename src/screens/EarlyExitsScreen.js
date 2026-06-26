import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text } from "react-native";
import Screen from "../components/Screen";
import { ActionCard, Surface } from "../components/Cards";
import { mobileApi } from "../api/client";
import { theme } from "../theme";
import { readCache, writeCache } from "../utils/cache";

export default function EarlyExitsScreen({ route, navigation }) {
  const { student } = route.params;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cachedAt, setCachedAt] = useState("");

  const openRequest = () => {
    navigation.getParent()?.navigate("Solicitudes", {
      screen: "RequestEarlyExit",
      params: { student },
    });
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      const cacheKey = `early_exits_${student.id}`;
      const cached = await readCache(cacheKey);

      if (cached?.value) {
        setRows(cached.value);
        setCachedAt(cached.savedAt || "");
      }

      try {
        const { data } = await mobileApi.get(`/apoderados/estudiantes/${student.id}/salidas`);
        const nextRows = data || [];
        setRows(nextRows);
        setCachedAt(new Date().toISOString());
        await writeCache(cacheKey, nextRows);
      } catch (err) {
        if (!cached?.value) {
          setRows([]);
          setError(err?.response?.data?.error || err.message || "No se pudieron cargar las salidas.");
        } else {
          setError("Mostrando el ultimo historial guardado.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [student.id]);

  return (
    <Screen eyebrow="Salidas" title={`Retiros de ${student.nombre}`} subtitle="Todo el historial de salidas, con acceso rapido a nuevas solicitudes.">
      <ActionCard title="Solicitar salida" subtitle="Indica fecha, hora y motivo del retiro." accent={theme.colors.danger} onPress={openRequest} />

      {error ? (
        <Surface>
          <Text style={styles.infoTitle}>Sincronizacion parcial</Text>
          <Text style={styles.infoText}>{error}</Text>
        </Surface>
      ) : null}

      {cachedAt ? <Text style={styles.cacheText}>Ultima sincronizacion: {cachedAt.slice(0, 16).replace("T", " ")}</Text> : null}

      {loading && !rows.length ? (
        <Surface style={styles.stateCard}>
          <ActivityIndicator color={theme.colors.danger} />
          <Text style={styles.infoText}>Cargando salidas...</Text>
        </Surface>
      ) : null}

      {!loading && rows.length === 0 ? (
        <Surface>
          <Text style={styles.infoTitle}>Sin salidas registradas</Text>
          <Text style={styles.infoText}>Este estudiante no tiene retiros cargados por ahora.</Text>
        </Surface>
      ) : null}

      {(rows || []).map((row) => (
        <Surface key={row.id}>
          <Text style={styles.date}>{row.fecha}</Text>
          <Text style={styles.detail}>{row.hora_salida} - {row.motivo}</Text>
        </Surface>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  date: {
    color: theme.colors.ink,
    fontWeight: "800",
  },
  detail: {
    color: theme.colors.inkSoft,
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
