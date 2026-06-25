import React, { useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import { ActionCard, Surface } from "../components/Cards";
import { mobileApi } from "../api/client";
import { theme } from "../theme";
import { useAuth } from "../context/AuthContext";

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await mobileApi.get("/apoderados/estudiantes");
      setStudents(data || []);
      const savedId = await SecureStore.getItemAsync("last_student_id");
      const chosen = (data || []).find((item) => String(item.id) === String(savedId)) || data?.[0] || null;
      setSelected(chosen);
    })();
  }, []);

  const choose = async (student) => {
    setSelected(student);
    await SecureStore.setItemAsync("last_student_id", String(student.id));
  };

  const initials = useMemo(() => {
    const name = user?.nombre?.[0] || "";
    const last = user?.apellido?.[0] || "";
    return `${name}${last}`.trim() || "AP";
  }, [user]);

  return (
    <Screen
      eyebrow="Inicio"
      title="Tus estudiantes"
      subtitle="Entra rapido al alumno correcto y revisa lo importante sin perderte en menus."
      right={
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      }
    >
      <Surface style={styles.welcomeCard}>
        <View style={styles.welcomeTop}>
          <View>
            <Text style={styles.welcomeEyebrow}>Cuenta activa</Text>
            <Text style={styles.welcomeTitle}>{user ? `${user.nombre} ${user.apellido}` : "Apoderado"}</Text>
          </View>
          <MaterialCommunityIcons name="shield-check-outline" size={22} color={theme.colors.inkSoft} />
        </View>
        <Text style={styles.welcomeText}>Todo el seguimiento del estudiante vive aqui: asistencia, atrasos, salidas y solicitudes.</Text>
      </Surface>

      <Surface style={styles.selectorCard}>
        <Text style={styles.selectorLabel}>Cambiar estudiante</Text>
        <View style={styles.pills}>
          {students.map((student) => (
            <Pressable key={student.id} onPress={() => choose(student)} style={[styles.pill, selected?.id === student.id && styles.pillActive]}>
              <Text style={[styles.pillText, selected?.id === student.id && styles.pillTextActive]}>
                {student.nombre} {student.apellido}
              </Text>
            </Pressable>
          ))}
        </View>
      </Surface>

      {selected ? (
        <>
          <Surface style={styles.studentCard}>
            <View style={styles.studentTop}>
              <View>
                <Text style={styles.studentEyebrow}>Estudiante seleccionado</Text>
                <Text style={styles.studentName}>
                  {selected.nombre} {selected.apellido}
                </Text>
              </View>
              <View style={styles.studentIconWrap}>
                <MaterialCommunityIcons name="account-school-outline" size={24} color={theme.colors.white} />
              </View>
            </View>
            <Text style={styles.studentCourse}>{selected.curso_nombre}</Text>
          </Surface>

          <ActionCard icon="view-dashboard-outline" title="Abrir resumen" subtitle="Indicadores y eventos recientes en una vista limpia." onPress={() => navigation.navigate("StudentSummary", { student: selected })} />
          <ActionCard icon="calendar-month-outline" title="Calendario mensual" subtitle="Asistencia del mes, dia por dia, con estados claros." accent={theme.colors.accent} onPress={() => navigation.navigate("AttendanceCalendar", { student: selected })} />
          <ActionCard icon="clock-alert-outline" title="Atrasos" subtitle="Minutos de retraso, estado y envio de justificacion." accent={theme.colors.warning} onPress={() => navigation.navigate("LateArrivals", { student: selected })} />
          <ActionCard icon="exit-run" title="Salidas" subtitle="Historial y nuevas solicitudes de retiro." accent={theme.colors.danger} onPress={() => navigation.navigate("EarlyExits", { student: selected })} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: theme.colors.ink,
    fontWeight: "700",
  },
  welcomeCard: {
    backgroundColor: theme.colors.surface,
  },
  welcomeTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  welcomeEyebrow: {
    color: theme.colors.inkSoft,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "700",
  },
  welcomeTitle: {
    color: theme.colors.ink,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 5,
  },
  welcomeText: {
    color: theme.colors.inkSoft,
    lineHeight: 21,
  },
  selectorCard: {
    backgroundColor: theme.colors.surface,
  },
  selectorLabel: {
    color: theme.colors.ink,
    fontWeight: "700",
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pillActive: {
    backgroundColor: theme.colors.ink,
    borderColor: theme.colors.ink,
  },
  pillText: {
    color: theme.colors.ink,
    fontWeight: "700",
  },
  pillTextActive: {
    color: theme.colors.white,
  },
  studentCard: {
    backgroundColor: theme.colors.surface,
    gap: 12,
  },
  studentTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  studentEyebrow: {
    color: theme.colors.inkSoft,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "700",
  },
  studentName: {
    color: theme.colors.ink,
    fontSize: 23,
    fontWeight: "700",
    marginTop: 6,
  },
  studentCourse: {
    color: theme.colors.inkSoft,
    fontSize: 15,
  },
  studentIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
