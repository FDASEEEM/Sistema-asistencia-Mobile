import * as SecureStore from "expo-secure-store";

function normalizePayload(value) {
  return {
    savedAt: new Date().toISOString(),
    value,
  };
}

export async function writeCache(key, value) {
  try {
    await SecureStore.setItemAsync(key, JSON.stringify(normalizePayload(value)));
  } catch (err) { console.warn('[cache] writeCache error:', err); }
}

export async function readCache(key) {
  try {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      savedAt: parsed.savedAt || null,
      value: parsed.value,
    };
  } catch (err) {
    console.warn('[cache] readCache error:', err);
    return null;
  }
}

export async function deleteCache(key) {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (err) { console.warn('[cache] deleteCache error:', err); }
}
