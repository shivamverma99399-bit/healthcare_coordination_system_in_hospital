const rawBaseUrl = String(import.meta.env.VITE_API_URL || "").trim();

if (!rawBaseUrl) {
  throw new Error("Missing VITE_API_URL. Set it to your Django backend base URL.");
}

export const BASE_URL = rawBaseUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");
export const API_BASE_URL = `${BASE_URL}/api`;

export function buildApiUrl(path = "") {
  const normalizedPath = String(path).replace(/^\/+/, "");
  return normalizedPath ? `${API_BASE_URL}/${normalizedPath}` : API_BASE_URL;
}
