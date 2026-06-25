import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput } from "react-native";
import Screen from "../components/Screen";
import { Surface } from "../components/Cards";
import { mobileApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { theme } from "../theme";

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const [email, setEmail] = useState(user?.email || "");
  const [telefono, setTelefono] = useState(user?.telefono || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const hasChanges = useMemo(() => {
    return email.trim() !== (user?.email || "") || telefono.trim() !== (user?.telefono || "");
  }, [email, telefono, user]);

  const save = async () => {
    if (!hasChanges) {
      Alert.alert("Sin cambios", "No hay datos nuevos para guardar.");
      return;
    }

    if (!password.trim()) {
      Alert.alert("Confirma tu clave", "Debes ingresar tu clave actual para guardar cambios.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await mobileApi.put("/apoderados/auth/me", {
        email: email.trim(),
        telefono: telefono.trim(),
        password: password.trim(),
      });
      updateUser(data.apoderado);
      setPassword("");
      Alert.alert("Perfil actualizado", "Tu correo y teléfono fueron guardados correctamente.");
    } catch (error) {
      const message = error?.response?.data?.error || error.message || "No se pudo actualizar el perfil.";
      Alert.alert("No se pudo actualizar", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen eyebrow="Cuenta" title={user ? `${user.nombre} ${user.apellido}` : "Perfil"} subtitle="Edita tus datos de contacto con validación por clave actual.">
      <Surface>
        <Text style={styles.label}>Correo</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="correo@ejemplo.com"
          placeholderTextColor="#7f96b3"
        />

        <Text style={[styles.label, styles.spaced]}>Teléfono</Text>
        <TextInput
          value={telefono}
          onChangeText={setTelefono}
          style={styles.input}
          keyboardType="phone-pad"
          placeholder="+56 9 1234 5678"
          placeholderTextColor="#7f96b3"
        />

        <Text style={[styles.label, styles.spaced]}>Clave actual</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          secureTextEntry
          placeholder="Ingresa tu clave para confirmar"
          placeholderTextColor="#7f96b3"
        />

        <Pressable style={[styles.saveButton, loading && styles.disabled]} onPress={save} disabled={loading}>
          <Text style={styles.saveText}>{loading ? "Guardando..." : "Guardar cambios"}</Text>
        </Pressable>
      </Surface>

      <Surface style={{ backgroundColor: theme.colors.surfaceAlt }}>
        <Text style={styles.hint}>Seguridad</Text>
        <Text style={styles.hintTitle}>Los cambios de contacto requieren validar tu clave actual antes de aplicarse.</Text>
      </Surface>

      <Pressable onPress={logout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    fontWeight: "700",
    color: theme.colors.ink,
  },
  input: {
    marginTop: 6,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    color: theme.colors.ink,
  },
  spaced: {
    marginTop: 14,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 16,
  },
  saveText: {
    color: "#fff",
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.7,
  },
  hint: {
    color: theme.colors.inkSoft,
  },
  hintTitle: {
    fontWeight: "700",
    color: theme.colors.ink,
    marginTop: 6,
  },
  logoutButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: "center",
  },
  logoutText: {
    color: "#fff",
    fontWeight: "700",
  },
});
