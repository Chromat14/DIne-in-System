const DEFAULT_API_BASE_URL = "http://localhost:8080/api/v1";

const browserOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost:8080";
const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
const resolvedApiUrl = new URL(rawApiBaseUrl, browserOrigin);

export const API_BASE_URL = resolvedApiUrl.toString().replace(/\/$/, "");
export const WS_URL = import.meta.env.VITE_WS_URL || `${resolvedApiUrl.origin}/ws`;
