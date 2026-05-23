const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  register: (body) => apiFetch("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => apiFetch("/api/auth/me"),
  stats: () => apiFetch("/api/dashboard/stats"),
  riskTrend: () => apiFetch("/api/dashboard/risk_trend"),
  failedByUser: () => apiFetch("/api/dashboard/failed-by-user"),
  alerts: () => apiFetch("/api/alerts"),
  incidents: () => apiFetch("/api/incidents"),
  updateIncident: (id, body) => apiFetch(`/api/incidents/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  logs: (uid) => apiFetch(`/api/logs${uid ? `?user_id=${uid}` : ""}`),
  searchLogs: (params) => apiFetch(`/api/logs/search?${new URLSearchParams(params)}`),
  logStats: () => apiFetch("/api/logs/stats"),
  geoData: () => apiFetch("/api/logs/geo"),
  latestFeed: () => apiFetch("/api/feed/latest"),
  userRiskProfile: (uid) => apiFetch(`/api/users/${uid}/risk-profile`),
  myLogs: () => apiFetch("/api/logs/me"),
  myAlerts: () => apiFetch("/api/users/me/alerts"),
  reportSuspicious: (body) => apiFetch("/api/users/me/report", { method: "POST", body: JSON.stringify(body) }),
  secureAccount: (body) => apiFetch("/api/users/me/secure", { method: "POST", body: JSON.stringify(body) }),
  users: () => apiFetch("/api/users"),
  blockUser: (id) => apiFetch(`/api/users/${id}/block`, { method: "PATCH" }),
  unblockUser: (id) => apiFetch(`/api/users/${id}/unblock`, { method: "PATCH" }),
  resetPassword: (id, body) => apiFetch(`/api/users/${id}/reset-password`, { method: "PATCH", body: JSON.stringify(body) }),
  mlStatus: () => apiFetch("/api/ml/status"),
  mlRetrain: () => apiFetch("/api/ml/retrain", { method: "POST" }),
  exportAlerts: () => `${API}/api/export/alerts`,
  exportLogs: () => `${API}/api/export/logs`,
};
