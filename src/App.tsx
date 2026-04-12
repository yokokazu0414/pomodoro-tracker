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
import { auth, loginWithGoogle, logout } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Button } from '@/components/ui/button';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
          <Button onClick={loginWithGoogle} className="w-full bg-rose-500 hover:bg-rose-600 text-white rounded-xl py-6 text-lg font-semibold">
            Sign in with Google
          </Button>
          <p className="text-xs text-rose-800/50 mt-4">
            ※スマホでログインエラーになる場合は、LINE等のアプリ内ブラウザではなく、SafariやChromeで開いてください。
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
