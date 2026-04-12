import { initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  signOut,
  setPersistence,
  indexedDBLocalPersistence,
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

/** Safari モバイルのリダイレクト後に localStorage より IndexedDB の方が安定することが多い */
export const auth = (() => {
  try {
    return initializeAuth(app, { persistence: indexedDBLocalPersistence });
  } catch {
    return getAuth(app);
  }
})();
auth.languageCode = 'ja';

export const db = getFirestore(app, firestoreDatabaseId);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/** React Strict Mode 等で getRedirectResult が二重に走ると挙動が壊れるため、1 ページロードにつき 1 回だけ */
let redirectResultOnce: Promise<Awaited<ReturnType<typeof getRedirectResult>>> | null =
  null;

export function consumeGoogleRedirectResultOnce() {
  if (!redirectResultOnce) {
    redirectResultOnce = (async () => {
      // モバイルで Google から戻った直後は通信スタックが立ち上がる前に getRedirectResult が走り
      // auth/network-request-failed になりやすいため、わずかに遅らせる。
      if (typeof window !== 'undefined' && shouldPreferGoogleRedirectAuth()) {
        await new Promise((r) => setTimeout(r, 450));
      }
      return getRedirectResult(auth);
    })();
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
 * Google ログイン。
 * デスクトップ: ポップアップ優先 → ブロック時のみリダイレクト。
 * モバイル: ポップアップ経由の firebaseapp.com/__/auth/handler?authType=signInViaPopup が不安定なためリダイレクト優先。
 * Cloud Run 等は Firebase「承認済みドメイン」＋ GCP の OAuth「JavaScript 生成元」にオリジンが必要。
 */
export async function loginWithGoogle(): Promise<void> {
  if (authLoginInFlight) {
    return;
  }
  authLoginInFlight = true;
  try {
    await setPersistence(auth, indexedDBLocalPersistence);

    const useRedirectFirst =
      !isRunningInIframe() && shouldPreferGoogleRedirectAuth();

    if (useRedirectFirst) {
      await signInWithRedirect(auth, googleProvider);
      return;
    }

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (first: unknown) {
      const code = getAuthErrorCode(first);
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/cancelled-popup-request'
      ) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      console.error('signInWithPopup', first);
      alert(formatFirebaseAuthHelp(first));
      return;
    }
  } catch (error: unknown) {
    console.error('Error signing in with Google', error);
    alert(formatFirebaseAuthHelp(error));
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
