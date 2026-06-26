import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
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
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(false);
  const [loading, setLoading] = useState(false);

  const hasChanges = useMemo(() => {
    return (
      email.trim() !== (user?.email || "") ||
      telefono.trim() !== (user?.telefono || "") ||
      Boolean(newPassword.trim())
    );
  }, [email, telefono, newPassword, user]);

  const save = async () => {
    if (!hasChanges) {
      Alert.alert("Sin cambios", "No hay datos nuevos para guardar.");
      return;
    }

    if (!password.trim()) {
      Alert.alert("Confirma tu clave", "Debes ingresar tu clave actual para guardar cambios.");
      return;
    }

    if (newPassword.trim()) {
      if (newPassword.trim().length < 8) {
        Alert.alert("Clave muy corta", "La nueva clave debe tener al menos 8 caracteres.");
        return;
      }

      if (newPassword.trim() !== confirmPassword.trim()) {
        Alert.alert("Claves distintas", "La confirmacion de la nueva clave no coincide.");
        return;
      }
    }

    setLoading(true);
    try {
      const { data } = await mobileApi.put("/apoderados/auth/me", {
        email: email.trim(),
        telefono: telefono.trim(),
        password: password.trim(),
        newPassword: newPassword.trim() || undefined,
        revokeOtherSessions,
      });
      updateUser(data.apoderado);
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setRevokeOtherSessions(false);
      Alert.alert("Perfil actualizado", "Los cambios fueron guardados correctamente.");
    } catch (error) {
      const message = error?.response?.data?.error || error.message || "No se pudo actualizar el perfil.";
      Alert.alert("No se pudo actualizar", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen eyebrow="Cuenta" title={user ? `${user.nombre} ${user.apellido}` : "Perfil"} subtitle="Actualiza tus datos, cambia tu clave y controla el acceso de tus sesiones.">
      <Surface>
        <Text style={styles.label}>Correo</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="correo@ejemplo.com"
          placeholderTextColor={theme.colors.inkMuted}
        />

        <Text style={[styles.label, styles.spaced]}>Telefono</Text>
        <TextInput
          value={telefono}
          onChangeText={setTelefono}
          style={styles.input}
          keyboardType="phone-pad"
          placeholder="+56 9 1234 5678"
          placeholderTextColor={theme.colors.inkMuted}
        />

        <Text style={[styles.label, styles.spaced]}>Clave actual</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          secureTextEntry
          placeholder="Ingresa tu clave actual"
          placeholderTextColor={theme.colors.inkMuted}
        />
      </Surface>

      <Surface style={{ backgroundColor: theme.colors.surfaceAlt }}>
        <Text style={styles.sectionTitle}>Seguridad</Text>

        <Text style={styles.label}>Nueva clave</Text>
        <TextInput
          value={newPassword}
          onChangeText={setNewPassword}
          style={styles.input}
          secureTextEntry
          placeholder="Minimo 8 caracteres"
          placeholderTextColor={theme.colors.inkMuted}
        />

        <Text style={[styles.label, styles.spaced]}>Confirmar nueva clave</Text>
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          style={styles.input}
          secureTextEntry
          placeholder="Repite la nueva clave"
          placeholderTextColor={theme.colors.inkMuted}
        />

        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.switchTitle}>Cerrar otras sesiones</Text>
            <Text style={styles.switchText}>Revoca el acceso de otros dispositivos despues de guardar.</Text>
          </View>
          <Switch
            value={revokeOtherSessions}
            onValueChange={setRevokeOtherSessions}
            trackColor={{ false: "#d6d3d1", true: "#c7d2fe" }}
            thumbColor={revokeOtherSessions ? theme.colors.accent : "#ffffff"}
          />
        </View>
      </Surface>

      <Pressable style={[styles.saveButton, loading && styles.disabled]} onPress={save} disabled={loading}>
        <Text style={styles.saveText}>{loading ? "Guardando..." : "Guardar cambios"}</Text>
      </Pressable>

      <Pressable onPress={logout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>Cerrar sesion</Text>
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
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    color: theme.colors.ink,
  },
  spaced: {
    marginTop: 14,
  },
  sectionTitle: {
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 16,
    marginBottom: 4,
  },
  switchRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  switchCopy: {
    flex: 1,
  },
  switchTitle: {
    color: theme.colors.ink,
    fontWeight: "700",
  },
  switchText: {
    color: theme.colors.inkSoft,
    marginTop: 4,
    lineHeight: 18,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveText: {
    color: "#fff",
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.7,
  },
  logoutButton: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  logoutText: {
    color: theme.colors.ink,
    fontWeight: "700",
  },
});
