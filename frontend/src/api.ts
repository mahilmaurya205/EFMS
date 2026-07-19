const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000/api";

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

export function clearToken() {
  localStorage.removeItem("efms_token");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message ?? "Request failed");
  return payload as T;
}

export function rupee(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
}
