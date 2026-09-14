import { getState, updateState } from './state';

export const DEFAULT_LOGIN = 'danya';
export const DEFAULT_PASSWORD = 'a0zOlB6rbhN914';

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function ensureDefaultAuth(): Promise<void> {
  if (getState().auth === null) {
    const passwordHash = await hashPassword(DEFAULT_PASSWORD);
    updateState('auth', { login: DEFAULT_LOGIN, passwordHash });
  }
}

export async function verifyLogin(login: string, password: string): Promise<boolean> {
  const auth = getState().auth;
  if (!auth || auth.login !== login) return false;
  return (await hashPassword(password)) === auth.passwordHash;
}

export async function changeCredentials(newLogin: string, newPassword: string): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  updateState('auth', { login: newLogin, passwordHash });
}
