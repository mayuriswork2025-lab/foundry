const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

const TOKEN_KEY = "auth_token"

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Calls the backend API, attaching the stored JWT (if any) as a bearer token. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()

  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new ApiError(res.status, body.detail ?? "Request failed")
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
