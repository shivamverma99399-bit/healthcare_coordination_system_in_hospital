const DEFAULT_API_URL = "https://healthcare-coordination-system-in.onrender.com";
const rawApiUrl = import.meta.env.VITE_API_URL || DEFAULT_API_URL;

export const BASE_URL = rawApiUrl.replace(/\/+$/, "");
export const API_BASE_URL = `${BASE_URL}/api`;
export const buildApiUrl = (path = "") => `${API_BASE_URL}/${String(path).replace(/^\/+/, "")}`;

console.log("API BASE:", import.meta.env.VITE_API_URL || DEFAULT_API_URL);
