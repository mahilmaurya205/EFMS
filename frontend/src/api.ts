const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000/api";
let activeRequests = 0;

function updateLoader(delta: 1 | -1) {
  activeRequests = Math.max(0, activeRequests + delta);
  window.dispatchEvent(new CustomEvent("efms:loading", { detail: { active: activeRequests > 0, count: activeRequests } }));
}

export type User = {
  _id?: string;
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  aadharNo?: string;
  address?: string;
  designation?: string;
  department?: string;
  basicSalary?: number;
  totalPayable?: number;
  expenseTotal?: number;
  isActive?: boolean;
  joiningDate?: string;
  createdAt?: string;
  password?: string;
  permissions?: {
    sidebar: string[];
    dashboard: string[];
  };
};

export function getToken() {
  return localStorage.getItem("efms_token");
}

export function setToken(token: string) {
  localStorage.setItem("efms_token", token);
}

export function setRefreshToken(token: string) {
  localStorage.setItem("efms_refresh_token", token);
}

export function clearToken() {
  localStorage.removeItem("efms_token");
  localStorage.removeItem("efms_refresh_token");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  updateLoader(1);
  try {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    let response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (response.status === 401 && path !== "/auth/login" && path !== "/auth/refresh") {
      const refreshToken = localStorage.getItem("efms_refresh_token");
      if (refreshToken) {
        const refreshed = await fetch(`${API_BASE}/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken }) });
        if (refreshed.ok) {
          const tokens = await refreshed.json() as { token: string; refreshToken: string };
          setToken(tokens.token);
          setRefreshToken(tokens.refreshToken);
          headers.set("Authorization", `Bearer ${tokens.token}`);
          response = await fetch(`${API_BASE}${path}`, { ...options, headers });
        } else clearToken();
      }
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload.message ?? "Request failed";
      window.dispatchEvent(new CustomEvent("efms:toast", { detail: { message, tone: "error" } }));
      throw new Error(message);
    }
    if (options.method && !["GET", "HEAD"].includes(options.method.toUpperCase()) && path !== "/auth/refresh") {
      const label = options.method === "DELETE" ? "Archived successfully" : options.method === "POST" ? "Saved successfully" : "Updated successfully";
      window.dispatchEvent(new CustomEvent("efms:toast", { detail: { message: label, tone: "success" } }));
    }
    return payload as T;
  } finally {
    updateLoader(-1);
  }
}

export async function apiBlob(path: string) {
  updateLoader(1);
  try {
    const headers = new Headers();
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${API_BASE}${path}`, { headers });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = payload.message ?? "Download failed";
      window.dispatchEvent(new CustomEvent("efms:toast", { detail: { message, tone: "error" } }));
      throw new Error(message);
    }
    return response.blob();
  } finally {
    updateLoader(-1);
  }
}

export function rupee(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
}
