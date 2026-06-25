import React, { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Screen from "../components/Screen";
import { Surface } from "../components/Cards";
import { mobileApi } from "../api/client";
import { theme } from "../theme";

export default function RequestJustificationScreen({ route, navigation }) {
  const { student, atraso } = route.params;
  const [motivo, setMotivo] = useState("");
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled) setImage(result.assets[0]);
  };

  const submit = async () => {
    if (!motivo.trim()) {
      Alert.alert("Falta el motivo", "Cuéntanos brevemente qué ocurrió.");
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append("asistencia_id", String(atraso?.id || ""));
      form.append("estudiante_id", String(student.id));
      form.append("motivo", motivo.trim());
      if (image) {
        form.append("evidencia", {
          uri: image.uri,
          name: image.fileName || `evidencia-${Date.now()}.jpg`,
          type: image.mimeType || "image/jpeg",
        });
      }
      await mobileApi.post("/apoderados/solicitudes/justificacion", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      Alert.alert("Solicitud enviada", image ? `La evidencia ${image.fileName || "adjunta"} quedó en revisión.` : "La justificación quedó en revisión.");
      navigation.goBack();
    } catch (error) {
      const message = error?.response?.data?.error || error?.response?.data?.message || error.message || "No se pudo enviar la justificación.";
      Alert.alert("No se pudo enviar", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen eyebrow="Nueva solicitud" title="Justificar atraso" subtitle={`Explica el contexto de ${student.nombre} y adjunta respaldo si lo tienes.`}>
      <Surface>
        <Text style={styles.label}>Motivo</Text>
        <TextInput multiline value={motivo} onChangeText={setMotivo} style={styles.input} placeholder="Describe la situacion" placeholderTextColor="#7f96b3" />

        <Pressable style={styles.secondary} onPress={pick}>
          <Text style={styles.secondaryText}>{image ? "Cambiar evidencia" : "Adjuntar evidencia"}</Text>
        </Pressable>

        <View style={styles.fileBox}>
          <Text style={styles.fileLabel}>Evidencia</Text>
          <Text style={styles.fileValue}>
            {image ? (image.fileName || image.uri.split("/").pop() || "imagen adjunta") : "No se ha adjuntado ninguna imagen"}
          </Text>
        </View>

        <Pressable style={[styles.primary, loading && styles.primaryDisabled]} onPress={submit} disabled={loading}>
          <Text style={styles.primaryText}>{loading ? "Enviando..." : "Enviar justificacion"}</Text>
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
    minHeight: 140,
    textAlignVertical: "top",
    color: theme.colors.ink,
  },
  primary: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 14,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "700",
  },
  secondary: {
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryText: {
    color: theme.colors.ink,
    fontWeight: "700",
  },
  primaryDisabled: {
    opacity: 0.75,
  },
  fileBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  fileLabel: {
    color: theme.colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  fileValue: {
    color: theme.colors.ink,
    fontWeight: "700",
  },
});
