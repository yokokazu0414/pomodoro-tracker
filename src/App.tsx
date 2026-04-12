/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { TimerProvider } from '@/lib/TimerContext';
import { Timer } from '@/components/Timer';
import { Dashboard } from '@/components/Dashboard';
import { DataManagement } from '@/components/DataManagement';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  auth,
  loginWithGoogle,
  loginWithGoogleViaPopup,
  logout,
  consumeGoogleRedirectResultOnce,
  isRunningInIframe,
} from '@/lib/firebase';
import { formatFirebaseAuthHelp } from '@/lib/authErrors';
import {
  isIOSWebKitSafariBrowser,
  isLikelyInAppBrowser,
  shouldPreferGoogleRedirectAuth,
} from '@/lib/browserEnv';
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  User,
} from 'firebase/auth';
import { Button } from '@/components/ui/button';

function copyAppUrlToClipboard(): void {
  if (typeof window === 'undefined') return;
  const url = window.location.href;
  void navigator.clipboard?.writeText(url).catch(() => {
    window.prompt('以下をコピーして Safari / Chrome のアドレス欄に貼り付けてください', url);
  });
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const inAppBrowser =
    typeof window !== 'undefined' && isLikelyInAppBrowser();
  const iosDevice =
    typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    // authStateReady / getRedirectResult が稀に未解決のまま止まる環境があるため、必ず UI を開放する
    const safetyTimer = window.setTimeout(() => {
      setLoading(false);
    }, 12000);

    void (async () => {
      try {
        // リダイレクト復帰時は先に OAuth 結果を処理（Safari で setPersistence より前が安定する事例あり）
        const redirectCred = await consumeGoogleRedirectResultOnce();
        await setPersistence(auth, browserLocalPersistence);
        setUser(redirectCred?.user ?? auth.currentUser);
      } catch (err: unknown) {
        console.error('[Auth] getRedirectResult', err);
        alert(formatFirebaseAuthHelp(err));
      } finally {
        window.clearTimeout(safetyTimer);
        setLoading(false);
      }
      unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
      });
    })();

    return () => {
      window.clearTimeout(safetyTimer);
      unsubscribe?.();
    };
  }, []);

  const handleLogin = () => {
    setSigningIn(true);
    void loginWithGoogle().finally(() => setSigningIn(false));
  };

  const handleLoginPopup = () => {
    setSigningIn(true);
    void loginWithGoogleViaPopup().finally(() => setSigningIn(false));
  };

  const showPopupFallback =
    typeof window !== 'undefined' &&
    !inAppBrowser &&
    !isRunningInIframe() &&
    shouldPreferGoogleRedirectAuth() &&
    !isIOSWebKitSafariBrowser();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#fff5f5]">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fff5f5] text-foreground p-4 font-sans">
        <div className="text-center space-y-6 max-w-md w-full bg-white p-8 rounded-3xl shadow-xl shadow-rose-100/50 border border-rose-50">
          <div className="text-6xl drop-shadow-sm" role="img" aria-label="tomato">🍅</div>
          <h1 className="text-3xl font-extrabold tracking-tight text-rose-600">Pomodoro Tracker</h1>
          <p className="text-rose-800/70 font-medium">Please sign in to sync your sessions across devices.</p>
          <p className="text-sm text-rose-700/80">
            {isRunningInIframe()
              ? '埋め込み表示の場合はポップアップでログインします。うまくいかない場合は新しいタブで開いてください。'
              : 'スマホでは Google に一度遷移してから戻ります。戻った直後は数秒 Loading のままになることがあります。'}
          </p>
          {iosDevice && !inAppBrowser && (
            <div className="text-left space-y-2 rounded-lg bg-sky-50 border border-sky-200 text-sky-950 px-3 py-3 text-xs leading-relaxed">
              <p className="font-semibold text-sm">iPhone / iPad: <code className="text-xs">firebaseapp.com</code> で止まる場合</p>
              <p>
                途中で URL が <code className="break-all bg-white/80 px-1 rounded">…firebaseapp.com</code> のまま白い画面・青いプログレスバーだけが続く、または最後に「The requested action is invalid」になるときは、<strong>本体 Safari ではない埋め込み表示</strong>のことが多いです（左上に「×」・画面下にコンパス「Safari で開く」がある画面）。
              </p>
              <p>
                <strong>コンパスをタップして Safari で開き直す</strong>か、下の URL コピーと同様に<strong>アドレスを Safari に貼って</strong>から、もう一度「Sign in with Google」を試してください。
              </p>
            </div>
          )}
          {inAppBrowser && (
            <div className="text-left space-y-3 rounded-lg bg-red-50 border border-red-200 text-red-950 px-3 py-3 leading-relaxed">
              <p className="text-sm font-semibold">アプリ内ブラウザです（LINE / Instagram 等）</p>
              <p className="text-xs">
                この環境では Google 認証ページへ<strong>移動せず</strong>、すぐに元の画面（チャットのメニュー等）に戻ることがあります。
                下の URL を<strong>コピーして Safari または Chrome で開き直し</strong>てからログインしてください。
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full border-red-300 text-red-900 hover:bg-red-100"
                onClick={() => copyAppUrlToClipboard()}
              >
                このページの URL をコピー
              </Button>
            </div>
          )}
          <p className="text-xs text-left rounded-lg bg-amber-50 border border-amber-200 text-amber-950 px-3 py-2 leading-relaxed">
            <strong className="font-semibold">初回・Cloud Run 運用時:</strong>
            次のホストを Firebase の「承認済みドメイン」に追加してください。
            <br />
            <code className="text-xs break-all select-all bg-white/80 px-1 rounded">
              {typeof window !== 'undefined' ? window.location.hostname : ''}
            </code>
          </p>
          <Button
            type="button"
            onClick={handleLogin}
            disabled={signingIn || inAppBrowser}
            className="w-full bg-rose-500 hover:bg-rose-600 text-white rounded-xl py-6 text-lg font-semibold disabled:opacity-50"
          >
            {inAppBrowser
              ? 'このブラウザではログインできません'
              : signingIn
                ? '移動中…'
                : 'Sign in with Google'}
          </Button>
          {showPopupFallback && (
            <Button
              type="button"
              variant="outline"
              onClick={handleLoginPopup}
              disabled={signingIn}
              className="w-full border-rose-200 text-rose-800 hover:bg-rose-50 rounded-xl py-3 text-sm"
            >
              うまくいかないとき: ポップアップでログイン
            </Button>
          )}
          <p className="text-xs text-rose-800/50 mt-4">
            ※スマホは <strong>LINE / Instagram / X 等の内蔵ブラウザではなく</strong>、Safari または Chrome
            で開いてください。「The requested action is invalid」は多くの場合これが原因です。
          </p>
        </div>
      </div>
    );
  }

  return (
    <TimerProvider>
      <div className="min-h-screen bg-[#fff5f5] text-foreground p-4 md:p-8 font-sans">
        <div className="max-w-5xl mx-auto space-y-8">
          <header className="flex flex-col items-center text-center mt-4 mb-8">
            <div className="flex items-center justify-center space-x-3 mb-2">
              <span className="text-5xl drop-shadow-sm" role="img" aria-label="tomato">🍅</span>
              <h1 className="text-4xl font-extrabold tracking-tight text-rose-600">Pomodoro Tracker</h1>
            </div>
            <p className="text-rose-800/70 font-medium">Manage your time, track your progress.</p>
            <div className="mt-4 flex items-center space-x-4 bg-white px-4 py-2 rounded-full shadow-sm border border-rose-100">
              <img src={user.photoURL || ''} alt="Profile" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
              <span className="text-sm font-medium text-rose-900">{user.displayName}</span>
              <Button variant="ghost" size="sm" onClick={logout} className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-full">
                Sign out
              </Button>
            </div>
          </header>

          <Tabs defaultValue="timer" className="w-full">
            <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto bg-rose-100/50 rounded-xl p-1">
              <TabsTrigger value="timer" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-rose-600 data-[state=active]:shadow-sm">Timer</TabsTrigger>
              <TabsTrigger value="dashboard" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-rose-600 data-[state=active]:shadow-sm">Dashboard</TabsTrigger>
              <TabsTrigger value="data" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-rose-600 data-[state=active]:shadow-sm">Data</TabsTrigger>
            </TabsList>
            <div className="mt-8">
              <TabsContent value="timer">
                <Timer />
              </TabsContent>
              <TabsContent value="dashboard">
                <Dashboard />
              </TabsContent>
              <TabsContent value="data">
                <DataManagement />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </TimerProvider>
  );
}
