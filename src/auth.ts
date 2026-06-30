const AUTH_STORAGE_KEY = 'lift-log-auth';
const expectedUsername = 'raj';
const expectedPassword = 'workout123';

export type AuthState = {
  isAuthenticated: boolean;
  username: string;
};

export function getAuthState(): AuthState {
  if (typeof window === 'undefined') {
    return { isAuthenticated: false, username: '' };
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return { isAuthenticated: false, username: '' };
  }

  try {
    return JSON.parse(raw) as AuthState;
  } catch {
    return { isAuthenticated: false, username: '' };
  }
}

export function login(username: string, password: string) {
  const cleanUsername = username.trim();
  const cleanPassword = password.trim();

  if (!cleanUsername || !cleanPassword) {
    return 'Enter a username and passcode to continue.';
  }

  if (cleanUsername !== expectedUsername || cleanPassword !== expectedPassword) {
    return 'That username or passcode is not accepted.';
  }

  const state: AuthState = { isAuthenticated: true, username: cleanUsername };
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
  return null;
}

export function logout() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}
