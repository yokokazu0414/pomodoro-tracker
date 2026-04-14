import React, { useState, useEffect } from 'react';
import { useTimer } from '@/lib/TimerContext';
import { db, auth } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { playChime } from '@/lib/audio';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

export function Timer() {
  const {
    status,
    timeLeft,
    plannedMinutes,
    task,
    startedAt,
    sessionId,
    setPlannedMinutes,
    setTask,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    finishEarly,
    clearSession,
    workEndedAt,
  } = useTimer();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [reflection, setReflection] = useState('');
  const [rank, setRank] = useState<'A' | 'B' | 'C' | ''>('');

  useEffect(() => {
    if (status === 'finished' && !isModalOpen) {
      setIsModalOpen(true);
      playChime();
    }
  }, [status, isModalOpen]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    if (task.trim().length === 0) return;
    startTimer();
  };

  const handleReflectionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value.replace(/\n/g, ''); // 改行を除去
    if (val.length <= 200) {
      setReflection(val);
    }
  };

  const handleSaveSession = async () => {
    if (!rank || !sessionId || !startedAt) return;
    const endedAt = workEndedAt ?? new Date().toISOString();

    const user = auth.currentUser;
    if (!user) return;

    // ローカルTZでの日付
    const date = format(new Date(startedAt), 'yyyy-MM-dd');

    try {
      await setDoc(doc(db, `users/${user.uid}/sessions`, sessionId), {
        session_id: sessionId,
        userId: user.uid,
        date,
        started_at: startedAt,
        ended_at: endedAt,
        planned_minutes: plannedMinutes,
        task: task.trim(),
        reflection: reflection.trim(),
        rank: rank as 'A' | 'B' | 'C',
      });
    } catch (error) {
      console.error("Error saving session to Firestore", error);
    }

    setIsModalOpen(false);
    setReflection('');
    setRank('');
    clearSession();
  };

  const handleDiscardClick = () => {
    setIsConfirmOpen(true);
  };

  const confirmDiscard = () => {
    setIsConfirmOpen(false);
    setIsModalOpen(false);
    setReflection('');
    setRank('');
    clearSession();
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-8 p-4">
      <Card className="w-full max-w-md border-rose-100 shadow-lg shadow-rose-100/50 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-center text-2xl text-rose-700">Pomodoro Timer</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6">
          <div className="text-7xl font-mono font-bold tracking-tighter text-rose-600 drop-shadow-sm">
            {formatTime(timeLeft)}
          </div>

          <div className="w-full space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task" className="text-rose-800">Task</Label>
              <Input
                id="task"
                placeholder="What are you working on?"
                value={task}
                onChange={(e) => setTask(e.target.value.slice(0, 200))}
                maxLength={200}
                disabled={status !== 'idle'}
                className="border-rose-200 focus-visible:ring-rose-500"
              />
              <p className="text-xs text-muted-foreground text-right">{task.length}/200</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minutes" className="text-rose-800">Duration (minutes)</Label>
              <Input
                id="minutes"
                type="number"
                min={1}
                max={120}
                value={plannedMinutes}
                onChange={(e) => setPlannedMinutes(Number(e.target.value))}
                disabled={status !== 'idle'}
                className="border-rose-200 focus-visible:ring-rose-500"
              />
            </div>
          </div>

          <div className="flex space-x-4">
            {status === 'idle' && (
              <Button onClick={handleStart} disabled={task.trim().length === 0} className="w-32 bg-rose-500 hover:bg-rose-600 text-white rounded-xl">
                Start
              </Button>
            )}
            {status === 'running' && (
              <>
                <Button onClick={pauseTimer} variant="secondary" className="w-24 rounded-xl">
                  Pause
                </Button>
                <Button onClick={finishEarly} variant="outline" className="w-24 border-rose-500 text-rose-500 hover:bg-rose-50 rounded-xl">
                  Finish
                </Button>
              </>
            )}
            {status === 'paused' && (
              <>
                <Button onClick={resumeTimer} className="w-24 bg-rose-500 hover:bg-rose-600 text-white rounded-xl">
                  Resume
                </Button>
                <Button onClick={finishEarly} variant="outline" className="w-24 border-rose-500 text-rose-500 hover:bg-rose-50 rounded-xl">
                  Finish
                </Button>
              </>
            )}
            {(status === 'running' || status === 'paused') && (
              <Button onClick={resetTimer} variant="ghost" className="w-24 text-muted-foreground hover:text-foreground rounded-xl">
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent 
          className="sm:max-w-[425px] rounded-2xl border-rose-100"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-rose-700">Session Completed! 🍅</DialogTitle>
            <DialogDescription>
              Great job! Please reflect on your session.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-rose-800">Task</Label>
              <div className="font-medium text-foreground">{task}</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reflection" className="text-rose-800">Reflection（1文字以上・最大200文字・改行なし）</Label>
              <Textarea
                id="reflection"
                placeholder="How did it go?"
                value={reflection}
                onChange={handleReflectionChange}
                maxLength={200}
                className="resize-none border-rose-200 focus-visible:ring-rose-500"
                rows={3}
              />
              <div className="text-xs text-right text-muted-foreground">
                {reflection.length}/200
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rank" className="text-rose-800">Rank</Label>
              <Select value={rank} onValueChange={(val: any) => setRank(val)}>
                <SelectTrigger id="rank" className="border-rose-200 focus:ring-rose-500">
                  <SelectValue placeholder="Select a rank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A: 集中し達成できた</SelectItem>
                  <SelectItem value="B">B: まあまあ</SelectItem>
                  <SelectItem value="C">C: 厳しかった・要改善</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleDiscardClick} className="rounded-xl">
              Discard
            </Button>
            <Button
              onClick={handleSaveSession}
              disabled={!rank || reflection.trim().length < 1 || reflection.length > 200}
              className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl"
            >
              Save Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-[300px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Discard Session?</DialogTitle>
            <DialogDescription>
              Are you sure you want to discard this record? It will not be saved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex space-x-2 justify-end">
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDiscard} className="rounded-xl">
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
