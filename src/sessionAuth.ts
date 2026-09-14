let authenticated = false;

type Listener = () => void;
const listeners = new Set<Listener>();

export function isAuthenticated(): boolean {
  return authenticated;
}

export function markAuthenticated(): void {
  authenticated = true;
  listeners.forEach((listener) => listener());
}

export function subscribeAuth(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetAuthenticationForTests(): void {
  authenticated = false;
}
