import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import { Surface } from "../components/Cards";
import { mobileApi } from "../api/client";
import { theme } from "../theme";
import { readCache, writeCache } from "../utils/cache";

const FILTERS = [
  { id: "all", label: "Todo" },
  { id: "action", label: "Requiere accion" },
  { id: "notifications", label: "Mensajes" },
  { id: "requests", label: "Solicitudes" },
];

function toTimestamp(value) {
  const parsed = Date.parse(value || "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getRequestTone(status, kind) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "aprobada") {
    return theme.colors.success;
  }
  if (normalized === "rechazada") {
    return theme.colors.danger;
  }
  return kind === "exit" ? theme.colors.danger : theme.colors.warning;
}

function normalizeAlertItem(item, source) {
  if (source === "notification") {
    return {
      id: `n-${item.id}`,
      rawId: item.id,
      source,
      title: item.titulo,
      message: item.mensaje,
      date: item.creado_en,
      status: item.leida ? "Leida" : "Nueva",
      tone: item.leida ? theme.colors.inkMuted : theme.colors.accent,
      icon: item.leida ? "bell-outline" : "bell-ring-outline",
      actionable: !item.leida,
      read: Boolean(item.leida),
    };
  }

  if (source === "justification") {
    return {
      id: `j-${item.id}`,
      rawId: item.id,
      source,
      title: `Justificacion ${String(item.estado || "").toLowerCase()}`,
      message: `${item.apellido}, ${item.nombre}: ${item.motivo}`,
      date: item.creado_en,
      status: item.estado,
      tone: getRequestTone(item.estado, "justification"),
      icon: "file-document-outline",
      actionable: String(item.estado || "").toLowerCase() === "pendiente",
      read: true,
      reviewComment: item.comentario_revision || "",
    };
  }

  return {
    id: `s-${item.id}`,
    rawId: item.id,
    source,
    title: `Salida ${String(item.estado || "").toLowerCase()}`,
    message: `${item.apellido}, ${item.nombre}: ${item.motivo}`,
    date: item.creado_en || item.fecha,
    status: item.estado,
    tone: getRequestTone(item.estado, "exit"),
    icon: "exit-run",
    actionable: String(item.estado || "").toLowerCase() === "pendiente",
    read: true,
    reviewComment: item.comentario_revision || "",
  };
}

export default function NotificationsScreen() {
  const [payload, setPayload] = useState({
    notifications: [],
    justifications: [],
    exits: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cachedAt, setCachedAt] = useState("");
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

  const persistPayload = async (nextPayload, nextSavedAt = new Date().toISOString()) => {
    setPayload(nextPayload);
    setCachedAt(nextSavedAt);
    await Promise.all([
      writeCache("alert_center_payload", nextPayload),
      writeCache("notifications_list", nextPayload.notifications),
      writeCache("requests_justificaciones", nextPayload.justifications),
      writeCache("requests_salidas", nextPayload.exits),
    ]);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      const cached = await readCache("alert_center_payload");
      if (cached?.value) {
        setPayload(cached.value);
        setCachedAt(cached.savedAt || "");
      }

      try {
        const [{ data: notifications }, { data: justifications }, { data: exits }] = await Promise.all([
          mobileApi.get("/apoderados/notificaciones"),
          mobileApi.get("/apoderados/solicitudes/justificacion"),
          mobileApi.get("/apoderados/solicitudes/salida"),
        ]);

        const nextPayload = {
          notifications: notifications || [],
          justifications: justifications || [],
          exits: exits || [],
        };

        await persistPayload(nextPayload);
      } catch (err) {
        if (!cached?.value) {
          setPayload({ notifications: [], justifications: [], exits: [] });
        }
        setError(cached?.value ? "Mostrando el ultimo centro de alertas guardado." : err?.response?.data?.error || err.message || "No se pudieron cargar las alertas.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const summary = useMemo(() => {
    const pendingJustifications = payload.justifications.filter((item) => String(item.estado || "").toLowerCase() === "pendiente").length;
    const pendingExits = payload.exits.filter((item) => String(item.estado || "").toLowerCase() === "pendiente").length;
    const unread = payload.notifications.filter((item) => !item.leida).length;
    return {
      unread,
      pendingJustifications,
      pendingExits,
      total: unread + pendingJustifications + pendingExits,
    };
  }, [payload]);

  const timeline = useMemo(() => {
    const allItems = [
      ...payload.notifications.map((item) => normalizeAlertItem(item, "notification")),
      ...payload.justifications.map((item) => normalizeAlertItem(item, "justification")),
      ...payload.exits.map((item) => normalizeAlertItem(item, "exit")),
    ].sort((a, b) => toTimestamp(b.date) - toTimestamp(a.date));

    if (filter === "action") {
      return allItems.filter((item) => item.actionable);
    }
    if (filter === "notifications") {
      return allItems.filter((item) => item.source === "notification");
    }
    if (filter === "requests") {
      return allItems.filter((item) => item.source !== "notification");
    }
    return allItems;
  }, [filter, payload]);

  const markAsRead = async (item) => {
    if (item.source !== "notification" || item.read) {
      return;
    }

    setBusyId(item.id);
    const nextNotifications = payload.notifications.map((entry) =>
      entry.id === item.rawId ? { ...entry, leida: true } : entry,
    );
    const nextPayload = { ...payload, notifications: nextNotifications };
    setPayload(nextPayload);

    try {
      await mobileApi.put(`/apoderados/notificaciones/${item.rawId}/leer`);
      await persistPayload(nextPayload);
    } catch (_) {
      setPayload(payload);
    } finally {
      setBusyId("");
    }
  };

  const markAllAsRead = async () => {
    if (!summary.unread) {
      return;
    }

    setMarkingAll(true);
    const nextPayload = {
      ...payload,
      notifications: payload.notifications.map((item) => ({ ...item, leida: true })),
    };
    setPayload(nextPayload);

    try {
      await mobileApi.put("/apoderados/notificaciones/leer-todas");
      await persistPayload(nextPayload);
    } catch (_) {
      setPayload(payload);
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <Screen eyebrow="Alertas" title="Centro de alertas" subtitle="Una sola vista para mensajes, estados de solicitudes y tareas pendientes.">
      <Surface>
        <View style={styles.headerRow}>
          <View style={styles.headerMetric}>
            <Text style={styles.metricLabel}>Sin leer</Text>
            <Text style={styles.metricValue}>{summary.unread}</Text>
          </View>
          <View style={styles.headerMetric}>
            <Text style={styles.metricLabel}>Pendientes</Text>
            <Text style={styles.metricValue}>{summary.pendingJustifications + summary.pendingExits}</Text>
          </View>
          <View style={styles.headerMetric}>
            <Text style={styles.metricLabel}>Total</Text>
            <Text style={styles.metricValue}>{summary.total}</Text>
          </View>
        </View>

        <Pressable style={[styles.markAllButton, !summary.unread && styles.disabledButton]} onPress={markAllAsRead} disabled={!summary.unread || markingAll}>
          <Text style={styles.markAllText}>{markingAll ? "Actualizando..." : "Marcar mensajes como leidos"}</Text>
        </Pressable>
      </Surface>

      <Surface>
        <Text style={styles.sectionTitle}>Filtrar</Text>
        <View style={styles.filterRow}>
          {FILTERS.map((item) => (
            <Pressable key={item.id} style={[styles.filterChip, filter === item.id && styles.filterChipActive]} onPress={() => setFilter(item.id)}>
              <Text style={[styles.filterChipText, filter === item.id && styles.filterChipTextActive]}>{item.label}</Text>
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

      {loading && !timeline.length ? (
        <Surface style={styles.stateCard}>
          <ActivityIndicator color={theme.colors.accent} />
          <Text style={styles.infoText}>Cargando centro de alertas...</Text>
        </Surface>
      ) : null}

      {!loading && timeline.length === 0 ? (
        <Surface>
          <Text style={styles.infoTitle}>Sin resultados</Text>
          <Text style={styles.infoText}>No hay alertas para este filtro.</Text>
        </Surface>
      ) : null}

      {timeline.length ? (
        <Surface>
          <Text style={styles.sectionTitle}>Actividad reciente</Text>
          {timeline.map((item, index) => (
            <View key={item.id} style={[styles.row, index ? styles.rowBorder : null]}>
              <View style={styles.rowMain}>
                <View style={[styles.iconWrap, { backgroundColor: theme.colors.surfaceAlt }]}>
                  <MaterialCommunityIcons name={item.icon} size={18} color={item.tone} />
                </View>
                <View style={styles.rowCopy}>
                  <View style={styles.rowTop}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={[styles.status, { color: item.tone }]}>{item.status}</Text>
                  </View>
                  <Text style={styles.message}>{item.message}</Text>
                  {item.reviewComment ? <Text style={styles.reviewText}>Revision: {item.reviewComment}</Text> : null}
                  <Text style={styles.date}>{String(item.date || "").replace("T", " ").slice(0, 16)}</Text>
                </View>
              </View>

              {item.source === "notification" && !item.read ? (
                <Pressable style={[styles.inlineButton, busyId === item.id && styles.disabledButton]} onPress={() => markAsRead(item)} disabled={busyId === item.id}>
                  <Text style={styles.inlineButtonText}>{busyId === item.id ? "..." : "Leida"}</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </Surface>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    gap: 10,
  },
  headerMetric: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  metricLabel: {
    color: theme.colors.inkSoft,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "700",
  },
  metricValue: {
    color: theme.colors.ink,
    fontSize: 24,
    fontWeight: "800",
    marginTop: 6,
  },
  markAllButton: {
    marginTop: 12,
    backgroundColor: theme.colors.ink,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  markAllText: {
    color: theme.colors.white,
    fontWeight: "700",
  },
  sectionTitle: {
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 16,
    marginBottom: 10,
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
    gap: 10,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  rowMain: {
    flexDirection: "row",
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: {
    flex: 1,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    color: theme.colors.ink,
    fontWeight: "700",
    flex: 1,
  },
  status: {
    fontWeight: "700",
    fontSize: 12,
  },
  message: {
    color: theme.colors.inkSoft,
    lineHeight: 19,
    marginTop: 4,
  },
  reviewText: {
    color: theme.colors.ink,
    lineHeight: 18,
    marginTop: 8,
    fontSize: 12,
  },
  date: {
    color: theme.colors.inkMuted,
    fontSize: 12,
    marginTop: 6,
  },
  inlineButton: {
    alignSelf: "flex-start",
    marginLeft: 48,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlineButtonText: {
    color: theme.colors.ink,
    fontWeight: "700",
    fontSize: 12,
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
  disabledButton: {
    opacity: 0.6,
  },
});
