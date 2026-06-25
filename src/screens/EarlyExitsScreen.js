import React, { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import Screen from "../components/Screen";
import { ActionCard, Surface } from "../components/Cards";
import { mobileApi } from "../api/client";
import { theme } from "../theme";

export default function EarlyExitsScreen({ route, navigation }) {
  const { student } = route.params;
  const [rows, setRows] = useState([]);

  const openRequest = () => {
    navigation.getParent()?.navigate("Solicitudes", {
      screen: "RequestEarlyExit",
      params: { student },
    });
  };

  useEffect(() => {
    (async () => {
      const { data } = await mobileApi.get(`/apoderados/estudiantes/${student.id}/salidas`);
      setRows(data || []);
    })();
  }, [student.id]);

  return (
    <Screen eyebrow="Salidas" title={`Retiros de ${student.nombre}`} subtitle="Todo el historial de salidas, con acceso rapido a nuevas solicitudes.">
      <ActionCard title="Solicitar salida" subtitle="Indica fecha, hora y motivo del retiro." accent={theme.colors.danger} onPress={openRequest} />
      {(rows || []).map((row) => (
        <Surface key={row.id}>
          <Text style={styles.date}>{row.fecha}</Text>
          <Text style={styles.detail}>{row.hora_salida} · {row.motivo}</Text>
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
});
