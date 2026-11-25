import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, indexedDBLocalPersistence, setPersistence, signInWithEmailAndPassword, signOut, onIdTokenChanged } from 'firebase/auth';
import { AuthError } from '../types/auth';

/** SDK owns credential persistence and refresh tokens. Never copy them into app storage. */
export interface CloudIdentityClient {
  signIn(email: string, password: string): Promise<void>;
  getToken(forceRefresh?: boolean): Promise<string | null>;
  signOut(): Promise<void>;
  onTokenChanged?(listener: (value: {uid: string; token: string} | null) => void): () => void;
}

let initialized: Promise<CloudIdentityClient> | undefined;
export function getFirebaseClient(): Promise<CloudIdentityClient> {
  return initialized ??= initializeClient().catch(error => {
    initialized = undefined;
    throw error;
  });
}

async function initializeClient(): Promise<CloudIdentityClient> {
  const env = (import.meta as ImportMeta & {env?: Record<string, string>}).env ?? {};
  const apiKey = env.VITE_FIREBASE_API_KEY;
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  if (!apiKey || !authDomain || !projectId) {
    throw new AuthError('CONFIGURATION_ERROR', 'Firebase public configuration is missing.');
  }
  const appName = 'library-flow-auth';
  const app = getApps().some(candidate => candidate.name === appName)
    ? getApp(appName) : initializeApp({apiKey, authDomain, projectId}, appName);
  const auth = getAuth(app);
  if ((import.meta as ImportMeta & {env?: {DEV?: boolean}}).env?.DEV && env.VITE_FIREBASE_AUTH_EMULATOR_HOST) {
    connectAuthEmulator(auth, `http://${env.VITE_FIREBASE_AUTH_EMULATOR_HOST}`);
  }
  await setPersistence(auth, indexedDBLocalPersistence);
  await auth.authStateReady();
  return {
    async signIn(email, password) { await signInWithEmailAndPassword(auth, email, password); },
    async getToken(forceRefresh = false) {
      await auth.authStateReady();
      return auth.currentUser ? auth.currentUser.getIdToken(forceRefresh) : null;
    },
    async signOut() { await signOut(auth); },
    onTokenChanged(listener) {
      return onIdTokenChanged(auth, user => {
        if (!user) { listener(null); return; }
        void user.getIdToken().then(token => {
          if (auth.currentUser?.uid === user.uid) listener({uid: user.uid, token});
        }).catch(() => listener(null));
      });
    },
  };
}
