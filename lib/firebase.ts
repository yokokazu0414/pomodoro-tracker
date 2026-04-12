import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  signOut,
  setPersistence,
  browserLocalPersistence,
  getRedirectResult,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

function requireEnv(name: keyof ImportMetaEnv): string {
  const v = import.meta.env[name];
  if (v === undefined || v === '') {
    throw new Error(
      `[Firebase] 環境変数 ${String(name)} がありません。`.concat(
        ' .env.example を .env.local にコピーし、Firebase Console → プロジェクトの設定 で値を設定してください。',
      ),
    );
  }
  return v;
}

const firebaseConfig = {
  apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requireEnv('VITE_FIREBASE_APP_ID'),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

const firestoreDatabaseId = requireEnv('VITE_FIRESTORE_DATABASE_ID');

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firestoreDatabaseId);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/** React Strict Mode 等で getRedirectResult が二重に走ると挙動が壊れるため、1 ページロードにつき 1 回だけ */
let redirectResultOnce: ReturnType<typeof getRedirectResult> | null = null;

export function consumeGoogleRedirectResultOnce() {
  if (!redirectResultOnce) {
    redirectResultOnce = getRedirectResult(auth);
  }
  return redirectResultOnce;
}

/** AI Studio 等の iframe 内ではリダイレクト認証が失敗しやすい（ウィンドウが一瞬で閉じる等） */
export function isRunningInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

let authLoginInFlight = false;

/**
 * Google ログイン。
 * - 通常: フルページリダイレクト（ポップアップブロックの影響を受けにくい）
 * - iframe 内（AI Studio 等）: リダイレクトが閉じる／無効になりやすいのでポップアップを使用
 */
export async function loginWithGoogle(): Promise<void> {
  if (authLoginInFlight) {
    return;
  }
  authLoginInFlight = true;
  try {
    await setPersistence(auth, browserLocalPersistence);

    if (isRunningInIframe()) {
      await signInWithPopup(auth, googleProvider);
      return;
    }

    await signInWithRedirect(auth, googleProvider);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error signing in with Google', error);
    alert(
      'ログインに失敗しました。Firebase の「承認済みドメイン」にこの URL を追加しているか、iframe の場合は別タブで開いて試してください。\n' +
        message,
    );
  } finally {
    authLoginInFlight = false;
  }
}

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out', error);
  }
};
