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
import { formatFirebaseAuthHelp, getAuthErrorCode } from '@/lib/authErrors';
import { shouldPreferGoogleRedirectAuth } from '@/lib/browserEnv';

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

/** initializeAuth + indexedDB は環境によって auth/argument-error になるため、getAuth + browserLocalPersistence に統一 */
export const auth = getAuth(app);
auth.languageCode = 'ja';

export const db = getFirestore(app, firestoreDatabaseId);

/** モバイルは `prompt` を付けると余計な画面遷移になり、リダイレクト復帰と競合しやすい */
function createGoogleProvider(): GoogleAuthProvider {
  const p = new GoogleAuthProvider();
  if (!shouldPreferGoogleRedirectAuth()) {
    p.setCustomParameters({ prompt: 'select_account' });
  }
  return p;
}

/** React Strict Mode 等で getRedirectResult が二重に走ると挙動が壊れるため、1 ページロードにつき 1 回だけ */
let redirectResultOnce: Promise<Awaited<ReturnType<typeof getRedirectResult>>> | null =
  null;

export function consumeGoogleRedirectResultOnce() {
  if (!redirectResultOnce) {
    redirectResultOnce = getRedirectResult(auth);
  }
  return redirectResultOnce;
}

/** AI Studio 等の iframe 内では別 UI 案内を出す */
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
 * リダイレクトが `firebaseapp.com` で止まる・invalid になる場合の代替。
 * モバイルでもフル Safari ならポップアップ（別タブ相当）が通ることがある。
 */
export function loginWithGoogleViaPopup(): Promise<void> {
  if (authLoginInFlight) {
    return Promise.resolve();
  }
  authLoginInFlight = true;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return (async () => {
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, provider);
    } catch (error: unknown) {
      console.error('signInWithPopup (fallback)', error);
      alert(formatFirebaseAuthHelp(error));
    } finally {
      authLoginInFlight = false;
    }
  })();
}

/**
 * Google ログイン。
 * デスクトップ: ポップアップ優先 → ブロック時のみリダイレクト。
 * モバイル: リダイレクト優先。
 *
 * iOS Safari では `async` 関数経由だとクリックのユーザージェスチャーが切れ、
 * `signInWithRedirect` が画面遷移を開始しない（無言で戻る）ことがあるため、
 * リダイレクト優先経路では **同期的に** `signInWithRedirect` を呼ぶ（`await` しない）。
 */
export function loginWithGoogle(): Promise<void> {
  if (authLoginInFlight) {
    return Promise.resolve();
  }
  authLoginInFlight = true;

  const useRedirectFirst =
    !isRunningInIframe() && shouldPreferGoogleRedirectAuth();
  const provider = createGoogleProvider();

  if (useRedirectFirst) {
    void setPersistence(auth, browserLocalPersistence);
    return signInWithRedirect(auth, provider)
      .catch((error: unknown) => {
        console.error('Error signing in with Google', error);
        alert(formatFirebaseAuthHelp(error));
      })
      .finally(() => {
        authLoginInFlight = false;
      });
  }

  return (async () => {
    try {
      await setPersistence(auth, browserLocalPersistence);
      try {
        await signInWithPopup(auth, provider);
      } catch (first: unknown) {
        const code = getAuthErrorCode(first);
        if (
          code === 'auth/popup-blocked' ||
          code === 'auth/cancelled-popup-request'
        ) {
          await signInWithRedirect(auth, createGoogleProvider());
          return;
        }
        console.error('signInWithPopup', first);
        alert(formatFirebaseAuthHelp(first));
      }
    } catch (error: unknown) {
      console.error('Error signing in with Google', error);
      alert(formatFirebaseAuthHelp(error));
    } finally {
      authLoginInFlight = false;
    }
  })();
}

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out', error);
  }
};
