import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Calendar } from "react-native-calendars";
import Screen from "../components/Screen";
import { Surface } from "../components/Cards";
import { mobileApi } from "../api/client";
import { theme } from "../theme";

const palette = {
  presente: "#12b886",
  ausente: "#ef4444",
  justificado: "#60a5fa",
  "sin estado": "#d6deea",
};

export default function AttendanceCalendarScreen({ route }) {
  const { student } = route.params;
  const [items, setItems] = useState([]);

  useEffect(() => {
    (async () => {
      const { data } = await mobileApi.get(`/apoderados/estudiantes/${student.id}/asistencia-mensual`);
      setItems(data.dias || []);
    })();
  }, [student.id]);

  const markedDates = useMemo(
    () =>
      Object.fromEntries(
        items.map((item) => [
          item.fecha,
          {
            selected: true,
            selectedColor: palette[item.estado] || palette["sin estado"],
          },
        ])
      ),
    [items]
  );

  return (
    <Screen eyebrow="Calendario" title={`Mes de ${student.nombre}`} subtitle="Una vista mensual mucho mas clara para detectar patrones de asistencia.">
      <Surface>
        <Calendar
          markedDates={markedDates}
          theme={{
            todayTextColor: theme.colors.accent,
            arrowColor: theme.colors.accent,
            textDayFontWeight: "600",
            textMonthFontWeight: "800",
            textDayHeaderFontWeight: "700",
          }}
        />
      </Surface>

      <Surface>
        <Text style={styles.sectionTitle}>Leyenda</Text>
        <View style={styles.legendGrid}>
          {Object.entries(palette).map(([key, color]) => (
            <View key={key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={styles.legendText}>{key}</Text>
            </View>
          ))}
        </View>
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: theme.colors.ink,
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 8,
  },
  legendGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceAlt,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 8,
  },
  legendText: {
    color: theme.colors.ink,
    fontWeight: "600",
  },
});
