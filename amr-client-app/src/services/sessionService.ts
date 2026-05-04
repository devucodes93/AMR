import { AuthResponse } from './authService';

type StoredSession = {
  user: AuthResponse['user'];
  session: AuthResponse['session'];
  savedAt: string;
};

let activeSession: StoredSession | null = null;

export async function saveAuthSession(payload: AuthResponse) {
  activeSession = {
    user: payload.user,
    session: payload.session,
    savedAt: new Date().toISOString(),
  };
}

export async function getSavedAuthSession(): Promise<StoredSession | null> {
  return activeSession;
}

export async function clearSavedAuthSession() {
  activeSession = null;
}
