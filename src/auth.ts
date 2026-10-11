// Google sign-in via Firebase Auth. Only loaded when VITE_FIREBASE_* is set
// (api mode against a server with auth on); the demo build never pulls it in.

export interface Auth {
  readonly enabled: boolean;
  /** Current user's Firebase ID token, or null when signed out. */
  token(): Promise<string | null>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}

const disabledAuth: Auth = {
  enabled: false,
  token: async () => null,
  signIn: async () => {},
  signOut: async () => {},
};

export function authConfigured(): boolean {
  const env = import.meta.env;
  return Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_AUTH_DOMAIN && env.VITE_FIREBASE_PROJECT_ID);
}

export async function initAuth(onChange: (email: string | null) => void): Promise<Auth> {
  if (!authConfigured()) return disabledAuth;

  const { initializeApp } = await import("@firebase/app");
  const fb = await import("@firebase/auth");
  const app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  });
  const auth = fb.getAuth(app);
  fb.onAuthStateChanged(auth, (user) => onChange(user?.email ?? null));

  return {
    enabled: true,
    token: async () => (auth.currentUser ? auth.currentUser.getIdToken() : null),
    signIn: async () => {
      await fb.signInWithPopup(auth, new fb.GoogleAuthProvider());
    },
    signOut: () => fb.signOut(auth),
  };
}
