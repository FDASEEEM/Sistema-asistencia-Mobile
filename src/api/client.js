import axios from "axios";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const PUBLIC_API_BASE_URL = "https://sistema-asistencia-mobile.onrender.com/api";

export const API_BASE_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  PUBLIC_API_BASE_URL;

export const mobileApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

let refreshPromise = null;

mobileApi.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("apoderado_access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

mobileApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (!original || error.response?.status !== 401 || original._retry) {
      throw error;
    }

    original._retry = true;

    if (!refreshPromise) {
      refreshPromise = (async () => {
        const refreshToken = await SecureStore.getItemAsync("apoderado_refresh_token");
        if (!refreshToken) {
          throw error;
        }
        const { data } = await axios.post(`${API_BASE_URL}/apoderados/auth/refresh`, { refreshToken });
        await SecureStore.setItemAsync("apoderado_access_token", data.token);
        await SecureStore.setItemAsync("apoderado_refresh_token", data.refreshToken);
        return data.token;
      })().finally(() => {
        refreshPromise = null;
      });
    }

    const newToken = await refreshPromise;
    original.headers.Authorization = `Bearer ${newToken}`;
    return mobileApi(original);
  }
);
