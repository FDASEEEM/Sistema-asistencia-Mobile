import React, { useMemo, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Calendar } from "react-native-calendars";
import Screen from "../components/Screen";
import { Surface } from "../components/Cards";
import { mobileApi } from "../api/client";
import { theme } from "../theme";

export default function RequestEarlyExitScreen({ route, navigation }) {
  const { student } = route.params;
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [motivo, setMotivo] = useState("");
  const [medico, setMedico] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showMotivo, setShowMotivo] = useState(false);
  const [otroMotivo, setOtroMotivo] = useState("");

  const formatHora = (value) => {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  };

  const motivos = useMemo(() => ([
    "Cita médica",
    "Trámite familiar",
    "Problema de salud",
    "Retiro por emergencia",
    "Otro",
  ]), []);

  const motivoSeleccionado = useMemo(() => {
    if (motivo && motivos.includes(motivo)) return motivo;
    if (motivo === "Otro" || otroMotivo.trim()) return "Otro";
    return "";
  }, [motivo, motivos]);

  const motivoFinal = motivoSeleccionado === "Otro" ? otroMotivo.trim() : motivo;

  const submit = async () => {
    const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha);
    const horaValida = /^\d{2}:\d{2}$/.test(hora);

    if (!fechaValida || !horaValida || motivoFinal.trim().length < 3) {
      Alert.alert("Revisa los datos", "Completa fecha, hora y motivo antes de enviar la solicitud.");
      return;
    }

    setLoading(true);
    try {
      await mobileApi.post("/apoderados/solicitudes/salida", {
        estudiante_id: student.id,
        fecha,
        hora_salida: hora.length === 5 ? `${hora}:00` : hora,
        motivo: motivoFinal,
        es_medico: medico,
      });
      Alert.alert("Solicitud enviada", "La salida fue enviada a revision.");
      navigation.goBack();
    } catch (error) {
      const message = error?.response?.data?.error || error.message || "No se pudo enviar la solicitud.";
      Alert.alert("No se pudo enviar", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen eyebrow="Nueva solicitud" title="Solicitar salida" subtitle={`Coordina con inspectoria el retiro de ${student.nombre}.`}>
      <Surface>
        <Text style={styles.label}>Fecha</Text>
        <Pressable onPress={() => setShowCalendar(true)} style={styles.inputButton}>
          <Text style={[styles.inputButtonText, !fecha && styles.placeholder]}>{fecha || "Selecciona una fecha"}</Text>
        </Pressable>

        <Modal visible={showCalendar} transparent animationType="fade" onRequestClose={() => setShowCalendar(false)}>
          <View style={styles.modalBackdrop}>
            <Surface style={styles.calendarCard}>
              <Text style={styles.modalTitle}>Elige la fecha</Text>
              <Calendar
                onDayPress={(day) => {
                  setFecha(day.dateString);
                  setShowCalendar(false);
                }}
                markedDates={fecha ? { [fecha]: { selected: true, selectedColor: theme.colors.primary } } : {}}
              />
              <Pressable style={styles.modalClose} onPress={() => setShowCalendar(false)}>
                <Text style={styles.modalCloseText}>Cerrar</Text>
              </Pressable>
            </Surface>
          </View>
        </Modal>

        <Text style={styles.label}>Hora</Text>
        <TextInput
          value={hora}
          onChangeText={(value) => setHora(formatHora(value))}
          style={styles.input}
          placeholder="14:30"
          placeholderTextColor="#7f96b3"
          keyboardType="numeric"
          maxLength={5}
        />

        <Text style={styles.label}>Motivo</Text>
        <Pressable onPress={() => setShowMotivo(true)} style={styles.inputButton}>
          <Text style={[styles.inputButtonText, !motivoSeleccionado && styles.placeholder]}>
            {motivoSeleccionado || "Selecciona un motivo"}
          </Text>
        </Pressable>

        {motivoSeleccionado === "Otro" ? (
          <TextInput
            value={otroMotivo}
            onChangeText={setOtroMotivo}
            style={styles.input}
            placeholder="Escribe el motivo"
            placeholderTextColor="#7f96b3"
          />
        ) : null}

        <Modal visible={showMotivo} transparent animationType="fade" onRequestClose={() => setShowMotivo(false)}>
          <View style={styles.modalBackdrop}>
            <Surface style={styles.calendarCard}>
              <Text style={styles.modalTitle}>Selecciona un motivo</Text>
              {motivos.map((item) => (
                <Pressable
                  key={item}
                  style={styles.optionRow}
                  onPress={() => {
                    setMotivo(item);
                    if (item !== "Otro") setOtroMotivo("");
                    setShowMotivo(false);
                  }}
                >
                  <Text style={styles.optionText}>{item}</Text>
                </Pressable>
              ))}
              <Pressable style={styles.modalClose} onPress={() => setShowMotivo(false)}>
                <Text style={styles.modalCloseText}>Cerrar</Text>
              </Pressable>
            </Surface>
          </View>
        </Modal>

        <Surface style={styles.switchCard}>
          <View style={styles.switchRow}>
            <Text style={styles.label}>Es salida medica</Text>
            <Switch value={medico} onValueChange={setMedico} trackColor={{ false: "#d6d3d1", true: "#a8a29e" }} thumbColor={medico ? theme.colors.primary : "#fff"} />
          </View>
        </Surface>

        <Pressable style={[styles.primary, loading && styles.primaryDisabled]} onPress={submit} disabled={loading}>
          <Text style={styles.primaryText}>{loading ? "Enviando..." : "Enviar solicitud"}</Text>
        </Pressable>
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    fontWeight: "700",
    color: theme.colors.ink,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    marginBottom: 12,
    color: theme.colors.ink,
  },
  inputButton: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    marginBottom: 12,
  },
  inputButtonText: {
    color: theme.colors.ink,
  },
  placeholder: {
    color: "#7f96b3",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  calendarCard: {
    width: "100%",
    maxWidth: 420,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.ink,
    marginBottom: 12,
  },
  optionRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  optionText: {
    color: theme.colors.ink,
    fontWeight: "600",
  },
  modalClose: {
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceAlt,
  },
  modalCloseText: {
    color: theme.colors.ink,
    fontWeight: "700",
  },
  switchCard: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  primary: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryDisabled: {
    opacity: 0.7,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "700",
  },
});
