import { auth } from './firebase';
export const API = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function authHeaders() {
  const token = await auth?.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : { Authorization: '' };
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(API + path, {
    ...options,
    headers: { ...(await authHeaders()), ...options.headers },
  });
  const result = await res.json();
  if (!res.ok) throw new ApiError(result.error || 'Couldn’t complete this request.', res.status);
  return result as T;
}
