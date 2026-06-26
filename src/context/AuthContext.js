import React, { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { mobileApi } from "../api/client";
import { registerPushToken } from "../notifications/registerPushToken";
import { deleteCache } from "../utils/cache";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync("apoderado_access_token");
      const refreshToken = await SecureStore.getItemAsync("apoderado_refresh_token");
      if (!token || !refreshToken) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await mobileApi.get("/apoderados/auth/me");
        setUser(data.apoderado);
        await registerPushToken();
      } catch (_) {
        await SecureStore.deleteItemAsync("apoderado_access_token");
        await SecureStore.deleteItemAsync("apoderado_refresh_token");
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
    } catch (_) {}
  };

  const logout = async () => {
    const refreshToken = await SecureStore.getItemAsync("apoderado_refresh_token");
    try {
      await mobileApi.post("/apoderados/auth/logout", { refreshToken });
    } catch (_) {}
    await SecureStore.deleteItemAsync("apoderado_access_token");
    await SecureStore.deleteItemAsync("apoderado_refresh_token");
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

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: Boolean(user), login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
