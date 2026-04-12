import React, { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, subDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Period = 'daily' | 'weekly' | 'monthly';

export function Dashboard() {
  const [period, setPeriod] = useState<Period>('daily');
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, `users/${user.uid}/sessions`),
      orderBy('started_at', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSessions = snapshot.docs.map(doc => doc.data());
      setSessions(fetchedSessions);
    }, (error) => {
      console.error("Error fetching sessions:", error);
    });

    return () => unsubscribe();
  }, []);

  const getChartData = () => {
    const now = new Date();
    let data: any[] = [];

    if (period === 'daily') {
      // 過去7日間
      const start = subDays(now, 6);
      const days = eachDayOfInterval({ start, end: now });
      data = days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const count = sessions.filter(s => s.date === dateStr).length;
        return { name: format(day, 'MM/dd'), count };
      });
    } else if (period === 'weekly') {
      // 過去4週間 (月曜始まり)
      for (let i = 3; i >= 0; i--) {
        const d = subDays(now, i * 7);
        const start = startOfWeek(d, { weekStartsOn: 1 });
        const end = endOfWeek(d, { weekStartsOn: 1 });
        const count = sessions.filter(s => {
          const sd = new Date(s.started_at);
          return sd >= start && sd <= end;
        }).length;
        data.push({ name: `${format(start, 'MM/dd')}~`, count });
      }
    } else if (period === 'monthly') {
      // 過去6ヶ月
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = startOfMonth(d);
        const end = endOfMonth(d);
        const count = sessions.filter(s => {
          const sd = new Date(s.started_at);
          return sd >= start && sd <= end;
        }).length;
        data.push({ name: format(start, 'yyyy/MM'), count });
      }
    }

    return data;
  };

  const chartData = getChartData();

  // 今日の回数
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayCount = sessions.filter(s => s.date === todayStr).length;

  // Pomo # の計算
  const sortedSessions = [...sessions].sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
  const pomoNumbers: Record<string, number> = {};
  const dailyCounts: Record<string, number> = {};
  
  sortedSessions.forEach(s => {
    const date = s.date;
    dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    pomoNumbers[s.session_id] = dailyCounts[date];
  });

  const displaySessions = [...sortedSessions].reverse();

  const getDuration = (start: string, end: string) => {
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    if (diffMins === 0) return `${diffSecs}s`;
    return `${diffMins}m ${diffSecs}s`;
  };

  return (
    <div className="space-y-6 p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-rose-100 shadow-sm rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-rose-800">Today's Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-rose-600">{todayCount}</div>
          </CardContent>
        </Card>
        <Card className="border-rose-100 shadow-sm rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-rose-800">Total Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-rose-600">{sessions.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-rose-100 shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="text-rose-700">Activity Trend</CardTitle>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList className="bg-rose-100/50">
              <TabsTrigger value="daily" className="data-[state=active]:bg-white data-[state=active]:text-rose-600">Daily</TabsTrigger>
              <TabsTrigger value="weekly" className="data-[state=active]:bg-white data-[state=active]:text-rose-600">Weekly</TabsTrigger>
              <TabsTrigger value="monthly" className="data-[state=active]:bg-white data-[state=active]:text-rose-600">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffe4e6" />
                <XAxis dataKey="name" stroke="#fda4af" />
                <YAxis allowDecimals={false} stroke="#fda4af" />
                <Tooltip cursor={{fill: '#fff1f2'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="count" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-rose-100 shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="text-rose-700">Recent History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-rose-100 overflow-hidden">
            <Table>
              <TableHeader className="bg-rose-50/50">
                <TableRow className="hover:bg-transparent border-rose-100">
                  <TableHead className="text-rose-800 font-semibold">Date</TableHead>
                  <TableHead className="text-rose-800 font-semibold">Pomo #</TableHead>
                  <TableHead className="text-rose-800 font-semibold">From</TableHead>
                  <TableHead className="text-rose-800 font-semibold">To</TableHead>
                  <TableHead className="text-rose-800 font-semibold">Duration</TableHead>
                  <TableHead className="text-rose-800 font-semibold">Rank</TableHead>
                  <TableHead className="text-rose-800 font-semibold">Reflection</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displaySessions.slice(0, 10).map((session) => (
                  <TableRow key={session.session_id} className="border-rose-100/50 hover:bg-rose-50/30">
                    <TableCell className="font-medium text-foreground">{format(new Date(session.started_at), 'MM/dd')}</TableCell>
                    <TableCell className="text-muted-foreground">#{pomoNumbers[session.session_id]}</TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(session.started_at), 'HH:mm')}</TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(session.ended_at), 'HH:mm')}</TableCell>
                    <TableCell className="text-muted-foreground">{getDuration(session.started_at, session.ended_at)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold
                        ${session.rank === 'A' ? 'bg-green-100 text-green-700' : 
                          session.rank === 'B' ? 'bg-yellow-100 text-yellow-700' : 
                          'bg-red-100 text-red-700'}`}>
                        {session.rank}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground" title={session.reflection}>
                      {session.reflection}
                    </TableCell>
                  </TableRow>
                ))}
                {displaySessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No sessions yet. Let's start a Pomodoro! 🍅
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
