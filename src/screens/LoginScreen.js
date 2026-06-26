import React, { useState } from "react";
import { ActivityIndicator, Image, Linking, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Surface } from "../components/Cards";
import { theme } from "../theme";
import { useAuth } from "../context/AuthContext";

const logo = require("../../logoamj.png");
const GITHUB_URL = "https://github.com/FDASEEEM";
const MAIL_URL = "mailto:javi.arancibiav@duocuc.cl";

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
        setError("No hubo respuesta del backend. Revisa la conexion.");
      } else if (err.response.status === 404) {
        setError("La API movil no existe en este servidor.");
      } else {
        setError(err.response?.data?.error || "No se pudo iniciar sesion.");
      }
    } finally {
      setLoading(false);
    }
  };

  const openUrl = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (_) {}
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.backdrop} pointerEvents="none">
        <View style={[styles.orb, styles.orbOne]} />
        <View style={[styles.orb, styles.orbTwo]} />
      </View>

      <View style={styles.content}>
        <View style={styles.brandBlock}>
          <View style={styles.logoWrap}>
            <Image source={logo} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.brandTitle}>Sistema Gestion de Asistencia AMJ</Text>
        </View>

        <Surface style={styles.card}>
          <View style={styles.form}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              style={styles.input}
              placeholder="Correo"
              placeholderTextColor={theme.colors.inkMuted}
            />

            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              returnKeyType="done"
              style={styles.input}
              placeholder="Contrasena"
              placeholderTextColor={theme.colors.inkMuted}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading}>
              {loading ? <ActivityIndicator color={theme.colors.white} /> : <Text style={styles.buttonText}>Entrar</Text>}
            </Pressable>
          </View>
        </Surface>

        <View style={styles.socialRow}>
          <View style={styles.socialIconWrap}>
            <MaterialCommunityIcons name="whatsapp" size={18} color={theme.colors.inkSoft} />
          </View>
          <Pressable style={({ pressed }) => [styles.socialIconWrap, pressed && styles.socialPressed]} onPress={() => openUrl(GITHUB_URL)}>
            <MaterialCommunityIcons name="github" size={18} color={theme.colors.inkSoft} />
          </Pressable>
          <Pressable style={({ pressed }) => [styles.socialIconWrap, pressed && styles.socialPressed]} onPress={() => openUrl(MAIL_URL)}>
            <MaterialCommunityIcons name="gmail" size={18} color={theme.colors.inkSoft} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 86,
    paddingBottom: 40,
    gap: 18,
  },
  backdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 240,
  },
  orb: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: theme.colors.primarySoft,
    opacity: 0.7,
  },
  orbOne: {
    width: 150,
    height: 150,
    top: 10,
    right: -45,
  },
  orbTwo: {
    width: 90,
    height: 90,
    top: 124,
    left: -22,
    backgroundColor: theme.colors.surfaceAlt,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderColor: theme.colors.border,
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 420,
  },
  brandBlock: {
    alignItems: "center",
    gap: 10,
    marginBottom: 2,
  },
  logoWrap: {
    width: 102,
    height: 122,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 92,
    height: 112,
  },
  brandTitle: {
    color: theme.colors.ink,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: theme.colors.ink,
  },
  error: {
    color: theme.colors.danger,
    lineHeight: 18,
    paddingTop: 2,
  },
  button: {
    marginTop: 8,
    minHeight: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.72,
  },
  buttonText: {
    color: theme.colors.white,
    fontWeight: "800",
    fontSize: 15,
  },
  socialRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 4,
  },
  socialIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  socialPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
});
