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
import { debugAuthErr, debugAuthIngest } from '@/lib/debugAuthIngest';

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
    const a = initializeAuth(app, { persistence: indexedDBLocalPersistence });
    // #region agent log
    debugAuthIngest(
      'firebase.ts:authInit',
      'initializeAuth ok',
      { path: 'initializeAuth' },
      'H4',
    );
    // #endregion
    return a;
  } catch (e: unknown) {
    // #region agent log
    debugAuthIngest(
      'firebase.ts:authInit',
      'initializeAuth threw; getAuth fallback',
      { ...debugAuthErr(e), path: 'getAuth_fallback' },
      'H4',
    );
    // #endregion
    return getAuth(app);
  }
})();
auth.languageCode = 'ja';

let db: ReturnType<typeof getFirestore>;
try {
  db = getFirestore(app, firestoreDatabaseId);
  // #region agent log
  debugAuthIngest(
    'firebase.ts:firestoreInit',
    'getFirestore ok',
    { databaseIdLen: String(firestoreDatabaseId).length },
    'H5',
  );
  // #endregion
} catch (e: unknown) {
  // #region agent log
  debugAuthIngest('firebase.ts:firestoreInit', 'getFirestore threw', debugAuthErr(e), 'H5');
  // #endregion
  throw e;
}
export { db };

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/** React Strict Mode 等で getRedirectResult が二重に走ると挙動が壊れるため、1 ページロードにつき 1 回だけ */
let redirectResultOnce: Promise<Awaited<ReturnType<typeof getRedirectResult>>> | null =
  null;

export function consumeGoogleRedirectResultOnce() {
  if (!redirectResultOnce) {
    redirectResultOnce = (async () => {
      // #region agent log
      debugAuthIngest(
        'firebase.ts:consumeRedirect',
        'before mobile delay / getRedirectResult',
        { mobileDelay: shouldPreferGoogleRedirectAuth() },
        'H2',
      );
      // #endregion
      // モバイルで Google から戻った直後は通信スタックが立ち上がる前に getRedirectResult が走り
      // auth/network-request-failed になりやすいため、わずかに遅らせる。
      if (typeof window !== 'undefined' && shouldPreferGoogleRedirectAuth()) {
        await new Promise((r) => setTimeout(r, 450));
      }
      // #region agent log
      debugAuthIngest('firebase.ts:consumeRedirect', 'calling getRedirectResult', {}, 'H2');
      // #endregion
      try {
        const cred = await getRedirectResult(auth);
        // #region agent log
        debugAuthIngest(
          'firebase.ts:consumeRedirect',
          'getRedirectResult resolved',
          { hasUser: !!cred?.user },
          'H2',
        );
        // #endregion
        return cred;
      } catch (e: unknown) {
        // #region agent log
        debugAuthIngest(
          'firebase.ts:consumeRedirect',
          'getRedirectResult threw',
          debugAuthErr(e),
          'H2',
        );
        // #endregion
        throw e;
      }
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
    // #region agent log
    debugAuthIngest('firebase.ts:loginWithGoogle', 'before setPersistence', {}, 'H1');
    // #endregion
    await setPersistence(auth, indexedDBLocalPersistence);
    // #region agent log
    debugAuthIngest('firebase.ts:loginWithGoogle', 'after setPersistence', {}, 'H1');
    // #endregion

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
    // #region agent log
    debugAuthIngest(
      'firebase.ts:loginWithGoogle',
      'catch',
      debugAuthErr(error),
      'H1',
    );
    // #endregion
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
