import React, { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import Screen from "../components/Screen";
import { Surface } from "../components/Cards";
import { mobileApi } from "../api/client";
import { theme } from "../theme";

export default function NotificationsScreen() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    (async () => {
      const { data } = await mobileApi.get("/apoderados/notificaciones");
      setItems(data || []);
    })();
  }, []);

  return (
    <Screen eyebrow="Alertas" title="Notificaciones" subtitle="Eventos clave del estudiante y respuestas de inspectoria.">
      {(items || []).map((item) => (
        <Surface key={item.id} style={[styles.card, item.leida ? styles.readCard : null]}>
          <Text style={styles.title}>{item.titulo}</Text>
          <Text style={styles.message}>{item.mensaje}</Text>
          <Text style={styles.date}>{item.creado_en?.replace("T", " ").slice(0, 16)}</Text>
        </Surface>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  readCard: {
    opacity: 0.78,
  },
  title: {
    fontWeight: "800",
    color: theme.colors.ink,
  },
  message: {
    color: theme.colors.inkSoft,
    lineHeight: 20,
  },
  date: {
    color: "#7b8ea8",
    fontSize: 12,
  },
});
