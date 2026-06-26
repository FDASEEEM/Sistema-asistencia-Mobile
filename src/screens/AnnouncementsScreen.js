import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import { Surface } from "../components/Cards";
import { mobileApi } from "../api/client";
import { theme } from "../theme";
import { readCache, writeCache } from "../utils/cache";

export default function AnnouncementsScreen() {
  const [items, setItems] = useState([]);
  const [readMap, setReadMap] = useState({});
  const [error, setError] = useState("");
  const [cachedAt, setCachedAt] = useState("");

  const load = useCallback(async () => {
    const [cached, cachedReadMap] = await Promise.all([
      readCache("announcements_list"),
      readCache("announcements_read_state"),
    ]);

    if (cached?.value) {
      setItems(cached.value);
      setCachedAt(cached.savedAt || "");
    }
    if (cachedReadMap?.value) {
      setReadMap(cachedReadMap.value);
    }

    try {
      setError("");
      const { data } = await mobileApi.get("/apoderados/anuncios");
      const nextItems = data || [];
      setItems(nextItems);
      setCachedAt(new Date().toISOString());
      await writeCache("announcements_list", nextItems);
    } catch (err) {
      if (!cached?.value) {
        setItems([]);
      }
      setError(cached?.value ? "Mostrando los ultimos anuncios guardados." : err?.response?.data?.error || err.message || "No se pudieron cargar los anuncios.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const unreadCount = useMemo(() => items.filter((item) => !readMap[item.id]).length, [items, readMap]);

  const markAsRead = async (id) => {
    const nextMap = { ...readMap, [id]: true };
    setReadMap(nextMap);
    await writeCache("announcements_read_state", nextMap);
  };

  return (
    <Screen eyebrow="Colegio" title="Anuncios activos" subtitle="Informacion oficial vigente del establecimiento.">
      <Surface>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>Pendientes</Text>
            <Text style={styles.summaryValue}>{unreadCount}</Text>
          </View>
          <Text style={styles.summaryText}>Los anuncios que abras quedan marcados como leidos en este dispositivo.</Text>
        </View>
      </Surface>

      {error ? (
        <Surface>
          <Text style={styles.emptyTitle}>No se pudieron cargar</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </Surface>
      ) : null}

      {cachedAt ? <Text style={styles.cacheText}>Ultima sincronizacion: {cachedAt.slice(0, 16).replace("T", " ")}</Text> : null}

      {!error && items.length === 0 ? (
        <Surface>
          <Text style={styles.emptyTitle}>Sin anuncios activos</Text>
          <Text style={styles.emptyText}>Si acabas de crear uno, asegurate de que tenga fecha de inicio vigente.</Text>
        </Surface>
      ) : null}

      {(items || []).map((item) => {
        const read = Boolean(readMap[item.id]);
        return (
          <Pressable key={item.id} onPress={() => markAsRead(item.id)}>
            <Surface style={[styles.card, read && styles.readCard]}>
              <View style={styles.rowTop}>
                <Text style={styles.title}>{item.titulo}</Text>
                {!read ? <View style={styles.unreadDot} /> : <MaterialCommunityIcons name="check" size={16} color={theme.colors.inkMuted} />}
              </View>
              <Text style={styles.message}>{item.mensaje}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>Activo desde {String(item.activo_desde || "").slice(0, 10)}</Text>
              </View>
            </Surface>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  summaryLabel: {
    color: theme.colors.inkSoft,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "700",
  },
  summaryValue: {
    color: theme.colors.ink,
    fontSize: 26,
    fontWeight: "800",
    marginTop: 4,
  },
  summaryText: {
    flex: 1,
    color: theme.colors.inkSoft,
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#fbfdff",
  },
  readCard: {
    opacity: 0.8,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    fontWeight: "800",
    color: theme.colors.ink,
    flex: 1,
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
  cacheText: {
    color: theme.colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: theme.colors.accent,
  },
});
