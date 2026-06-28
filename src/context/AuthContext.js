import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { mobileApi } from "../api/client";
import { registerPushToken } from "../notifications/registerPushToken";
import { deleteCache } from "../utils/cache";

const AuthContext = createContext(null);
const BIOMETRIC_ENABLED_KEY = "biometric_enabled";

async function isBiometricAvailable() {
  if (Platform.OS !== "android" || Constants.appOwnership === "expo") {
    return false;
  }

  let Device;
  let LocalAuthentication;

  try {
    Device = require("expo-device");
    LocalAuthentication = require("expo-local-authentication");
  } catch (error) {
    console.warn("[AuthContext] biometric modules unavailable:", error?.message || error);
    return false;
  }

  if (!Device?.isDevice || !LocalAuthentication) {
    return false;
  }

  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);

  return hasHardware && isEnrolled;
}

async function authenticateWithBiometrics() {
  if (Constants.appOwnership === "expo") {
    throw new Error("La biometria no esta disponible en Expo Go.");
  }

  let LocalAuthentication;

  try {
    LocalAuthentication = require("expo-local-authentication");
  } catch (error) {
    throw new Error("La biometria no esta disponible en esta compilacion.");
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Desbloquear con huella",
    cancelLabel: "Cancelar",
    disableDeviceFallback: true,
    biometricsSecurityLevel: "strong",
  });

  return result.success;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  async function hydrateSession() {
    const token = await SecureStore.getItemAsync("apoderado_access_token");
    const refreshToken = await SecureStore.getItemAsync("apoderado_refresh_token");
    if (!token || !refreshToken) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await mobileApi.get("/apoderados/auth/me");
      setUser(data.apoderado);
      try {
        await registerPushToken();
      } catch (pushErr) {
        console.warn("[AuthContext] registerPushToken error:", pushErr);
      }
    } catch (err) {
      console.warn("[AuthContext] /me error:", err);
      await SecureStore.deleteItemAsync("apoderado_access_token");
      await SecureStore.deleteItemAsync("apoderado_refresh_token");
      await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
      setBiometricEnabled(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const enabled = (await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY)) === "true";
        setBiometricEnabled(enabled);

        let available = false;
        try {
          available = await isBiometricAvailable();
        } catch (error) {
          console.warn("[AuthContext] biometric availability error:", error);
        }
        setBiometricAvailable(available);

        if (enabled && available) {
          const unlocked = await authenticateWithBiometrics();
          if (!unlocked) {
            return;
          }
        } else if (enabled && !available) {
          await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
          setBiometricEnabled(false);
        }

        await hydrateSession();
      } catch (error) {
        console.warn("[AuthContext] startup error:", error);
        await hydrateSession();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email, password) => {
    const { data } = await mobileApi.post("/apoderados/auth/login", { email, password });
    await SecureStore.setItemAsync("apoderado_access_token", data.token);
    await SecureStore.setItemAsync("apoderado_refresh_token", data.refreshToken);
    setUser(data.apoderado);
    try {
      await registerPushToken();
    } catch (err) { console.warn('[AuthContext] registerPushToken error:', err); }
  };

  const logout = async () => {
    const refreshToken = await SecureStore.getItemAsync("apoderado_refresh_token");
    try {
      await mobileApi.post("/apoderados/auth/logout", { refreshToken });
    } catch (err) { console.warn('[AuthContext] logout error:', err); }
    await SecureStore.deleteItemAsync("apoderado_access_token");
    await SecureStore.deleteItemAsync("apoderado_refresh_token");
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
    await SecureStore.deleteItemAsync("last_student_id");
    await deleteCache("students_list");
    await deleteCache("announcements_list");
    await deleteCache("notifications_list");
    await deleteCache("requests_justificaciones");
    await deleteCache("requests_salidas");
    await deleteCache("alert_center_payload");
    setUser(null);
  };

  const updateUser = (nextUser) => setUser(nextUser);

  const enableBiometricUnlock = async () => {
    const available = await isBiometricAvailable();
    setBiometricAvailable(available);

    if (!available) {
      throw new Error("Tu dispositivo no tiene biometria disponible o no esta configurada.");
    }

    const unlocked = await authenticateWithBiometrics();
    if (!unlocked) {
      throw new Error("No se pudo confirmar la huella.");
    }

    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, "true");
    setBiometricEnabled(true);
  };

  const disableBiometricUnlock = async () => {
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
    setBiometricEnabled(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(user),
        login,
        logout,
        updateUser,
        biometricAvailable,
        biometricEnabled,
        enableBiometricUnlock,
        disableBiometricUnlock,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
