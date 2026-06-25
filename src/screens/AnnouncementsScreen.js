import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Screen from "../components/Screen";
import { Surface } from "../components/Cards";
import { mobileApi } from "../api/client";
import { theme } from "../theme";

export default function AnnouncementsScreen() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const { data } = await mobileApi.get("/apoderados/anuncios");
      setItems(data || []);
    } catch (err) {
      setItems([]);
      setError(err?.response?.data?.error || err.message || "No se pudieron cargar los anuncios.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Screen eyebrow="Colegio" title="Anuncios activos" subtitle="Informacion oficial vigente del establecimiento.">
      {error ? (
        <Surface>
          <Text style={styles.emptyTitle}>No se pudieron cargar</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </Surface>
      ) : null}

      {!error && items.length === 0 ? (
        <Surface>
          <Text style={styles.emptyTitle}>Sin anuncios activos</Text>
          <Text style={styles.emptyText}>Si acabas de crear uno, asegúrate de que tenga fecha de inicio vigente.</Text>
        </Surface>
      ) : null}

      {(items || []).map((item) => (
        <Surface key={item.id} style={styles.card}>
          <Text style={styles.title}>{item.titulo}</Text>
          <Text style={styles.message}>{item.mensaje}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>Activo desde {String(item.activo_desde || "").slice(0, 10)}</Text>
          </View>
        </Surface>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fbfdff",
  },
  title: {
    fontWeight: "800",
    color: theme.colors.ink,
  },
  message: {
    color: theme.colors.inkSoft,
    lineHeight: 20,
  },
  emptyTitle: {
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 16,
    marginBottom: 6,
  },
  emptyText: {
    color: theme.colors.inkSoft,
    lineHeight: 20,
  },
  metaRow: {
    marginTop: 10,
  },
  meta: {
    color: theme.colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
  },
});
