import axios from "axios";

function resolveApiBase() {
  const configuredUrl = process.env.REACT_APP_BACKEND_URL;
  if (typeof window === "undefined") return configuredUrl || "";
  if (!configuredUrl) return window.location.origin;

  try {
    const url = new URL(configuredUrl);
    const isLocalBackend = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    const isRemoteBrowser = !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    if (isLocalBackend && isRemoteBrowser) {
      url.hostname = window.location.hostname;
      return url.origin;
    }
    return url.origin;
  } catch {
    return configuredUrl;
  }
}

export const API_BASE = resolveApiBase();
export const API = `${API_BASE}/api`;

const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("admin_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function formatApiError(e) {
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || "").join(" ");
  return "Terjadi kesalahan. Silakan coba lagi.";
}

export const formatRupiah = (n) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

export const formatTanggal = (dateStr) =>
  new Date(dateStr + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default api;
