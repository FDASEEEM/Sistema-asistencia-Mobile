import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import { Surface } from "../components/Cards";
import { mobileApi } from "../api/client";
import { theme } from "../theme";

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

export default function RequestsScreen({ navigation }) {
  const [justificaciones, setJustificaciones] = useState([]);
  const [salidas, setSalidas] = useState([]);

  useEffect(() => {
    (async () => {
      const [{ data: j }, { data: s }] = await Promise.all([
        mobileApi.get("/apoderados/solicitudes/justificacion"),
        mobileApi.get("/apoderados/solicitudes/salida"),
      ]);
      setJustificaciones(j || []);
      setSalidas(s || []);
    })();
  }, []);

  const total = useMemo(() => justificaciones.length + salidas.length, [justificaciones.length, salidas.length]);

  return (
    <Screen eyebrow="Seguimiento" title="Solicitudes" subtitle="Revisa el historial de justificaciones y salidas, con su estado actual.">
      <Surface>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.kicker}>Resumen</Text>
            <Text style={styles.total}>{total} solicitudes</Text>
          </View>
          <View style={styles.quickActions}>
            <Pressable style={styles.ghostButton} onPress={() => navigation.navigate("RequestJustification", { student: justificaciones[0] ? { id: justificaciones[0].estudiante_id, nombre: justificaciones[0].nombre } : { id: 0, nombre: "" }, atraso: null })}>
              <Text style={styles.ghostButtonText}>Justificar</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("RequestEarlyExit", { student: salidas[0] ? { id: salidas[0].estudiante_id, nombre: salidas[0].nombre } : { id: 0, nombre: "" } })}>
              <Text style={styles.primaryButtonText}>Salida</Text>
            </Pressable>
          </View>
        </View>
      </Surface>

      <Surface>
        <Text style={styles.sectionTitle}>Justificaciones</Text>
        {justificaciones.length === 0 ? (
          <Text style={styles.empty}>No hay justificaciones aún.</Text>
        ) : (
          justificaciones.map((item) => (
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
              {item.evidencia_url ? <Text style={styles.evidence}>Evidencia adjunta</Text> : null}
            </View>
          ))
        )}
      </Surface>

      <Surface>
        <Text style={styles.sectionTitle}>Salidas</Text>
        {salidas.length === 0 ? (
          <Text style={styles.empty}>No hay solicitudes de salida aún.</Text>
        ) : (
          salidas.map((item) => (
            <View key={`s-${item.id}`} style={styles.row}>
              <View style={styles.rowTop}>
                <Text style={styles.name}>
                  {item.apellido}, {item.nombre}
                </Text>
                <StatusPill status={item.estado} />
              </View>
              <Text style={styles.meta}>
                {item.fecha} · {item.hora_salida}
              </Text>
              <Text style={styles.detail} numberOfLines={2}>
                {item.motivo}
              </Text>
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
});
