const rawApiUrl = import.meta.env.VITE_API_URL || "";

export const BASE_URL = rawApiUrl.replace(/\/+$/, "");
export const API_BASE_URL = BASE_URL ? `${BASE_URL}/api` : "/api";

console.log("API URL:", import.meta.env.VITE_API_URL);

