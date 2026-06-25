import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Screen from "../components/Screen";
import { theme } from "../theme";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../api/client";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await login(email, password);
    } catch (err) {
      if (!err.response) {
        setError(`No hubo respuesta del backend. API actual: ${API_BASE_URL}`);
      } else if (err.response.status === 404) {
        setError(`La API movil no existe en este servidor. API actual: ${API_BASE_URL}`);
      } else {
        setError(err.response?.data?.error || `No se pudo iniciar sesion. API actual: ${API_BASE_URL}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen eyebrow="Sistema Cesar" title="Portal movil para apoderados" subtitle="Consulta asistencia, atrasos, salidas y anuncios del colegio desde una sola app." scroll={false} variant="hero">
      <View style={styles.panel}>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Acceso seguro</Text>
          </View>
          <Text style={styles.helper}>API actual: {API_BASE_URL}</Text>
        </View>

        <Text style={styles.label}>Correo</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          placeholder="apoderado@colegio.cl"
          placeholderTextColor="#7f96b3"
        />

        <Text style={styles.label}>Contrasena</Text>
        <TextInput value={password} onChangeText={setPassword} style={styles.input} secureTextEntry placeholder="Tu contrasena" placeholderTextColor="#7f96b3" />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  badgeRow: {
    gap: 10,
    marginBottom: 4,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: theme.colors.primarySoft,
  },
  badgeText: {
    color: theme.colors.ink,
    fontWeight: "700",
    fontSize: 12,
  },
  helper: {
    color: theme.colors.inkSoft,
    fontSize: 12,
  },
  label: {
    color: theme.colors.ink,
    fontWeight: "700",
  },
  input: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: theme.colors.ink,
  },
  button: {
    marginTop: 10,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    alignItems: "center",
    paddingVertical: 16,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  error: {
    color: theme.colors.danger,
  },
});
