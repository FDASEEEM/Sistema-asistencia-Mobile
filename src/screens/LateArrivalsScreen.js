import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import { ActionCard, Surface } from "../components/Cards";
import { mobileApi } from "../api/client";
import { theme } from "../theme";

export default function LateArrivalsScreen({ route, navigation }) {
  const { student } = route.params;
  const [rows, setRows] = useState([]);

  const openRequest = () => {
    navigation.getParent()?.navigate("Solicitudes", {
      screen: "RequestJustification",
      params: { student, atraso: rows[0] || null },
    });
  };

  useEffect(() => {
    (async () => {
      const { data } = await mobileApi.get(`/apoderados/estudiantes/${student.id}/atrasos`);
      setRows(data || []);
    })();
  }, [student.id]);

  return (
    <Screen eyebrow="Atrasos" title={`Historial de ${student.nombre}`} subtitle="Revisa minutos de retraso y justifica rapido si hace falta.">
      <ActionCard title="Enviar justificacion" subtitle="Adjunta una foto y explica el motivo del atraso." accent={theme.colors.warning} onPress={openRequest} />
      {(rows || []).map((row) => (
        <Surface key={row.id}>
          <View style={styles.rowTop}>
            <Text style={styles.date}>{row.fecha}</Text>
            <View style={[styles.statusPill, row.justificado ? styles.statusDone : styles.statusPending]}>
              <Text style={[styles.statusText, row.justificado ? styles.statusDoneText : styles.statusPendingText]}>{row.justificado ? "Justificado" : "Pendiente"}</Text>
            </View>
          </View>
          <Text style={styles.detail}>{row.hora_ingreso} · {row.minutos_retraso} min de retraso</Text>
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
});
