let authenticated = false;

export function isAuthenticated(): boolean {
  return authenticated;
}

export function markAuthenticated(): void {
  authenticated = true;
}

export function resetAuthenticationForTests(): void {
  authenticated = false;
}
