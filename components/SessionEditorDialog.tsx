import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type SessionRecord = {
  session_id: string;
  userId: string;
  date: string;
  started_at: string;
  ended_at: string;
  planned_minutes: number;
  task: string;
  reflection: string;
  rank: 'A' | 'B' | 'C';
};

function isoToDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  mode: 'create' | 'edit';
  initial: SessionRecord | null;
};

export function SessionEditorDialog({ open, onOpenChange, userId, mode, initial }: Props) {
  const [task, setTask] = useState('');
  const [reflection, setReflection] = useState('');
  const [rank, setRank] = useState<'A' | 'B' | 'C' | ''>('');
  const [plannedMinutes, setPlannedMinutes] = useState(25);
  const [startedLocal, setStartedLocal] = useState('');
  const [endedLocal, setEndedLocal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === 'edit' && initial) {
      setTask(initial.task);
      setReflection(initial.reflection);
      setRank(initial.rank);
      setPlannedMinutes(initial.planned_minutes);
      setStartedLocal(isoToDatetimeLocalValue(initial.started_at));
      setEndedLocal(isoToDatetimeLocalValue(initial.ended_at));
    } else {
      const now = new Date();
      const end = new Date(now.getTime() + 25 * 60 * 1000);
      setTask('');
      setReflection('');
      setRank('');
      setPlannedMinutes(25);
      setStartedLocal(isoToDatetimeLocalValue(now.toISOString()));
      setEndedLocal(isoToDatetimeLocalValue(end.toISOString()));
    }
  }, [open, mode, initial]);

  const handleReflectionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value.replace(/\n/g, '');
    if (val.length <= 200) setReflection(val);
  };

  const handleSave = async () => {
    setError(null);
    if (!rank) {
      setError('Rank を選んでください。');
      return;
    }
    const t = task.trim();
    if (t.length < 1 || t.length > 200) {
      setError('タスクは 1〜200 文字にしてください。');
      return;
    }
    const ref = reflection.trim();
    if (ref.length < 1 || ref.length > 200) {
      setError('振り返りは 1〜200 文字にしてください。');
      return;
    }
    const startMs = new Date(startedLocal).getTime();
    const endMs = new Date(endedLocal).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      setError('開始・終了の日時が不正です。');
      return;
    }
    if (endMs <= startMs) {
      setError('終了は開始より後である必要があります。');
      return;
    }
    if (plannedMinutes < 1 || plannedMinutes > 120) {
      setError('計画分数は 1〜120 にしてください。');
      return;
    }

    const sessionId = mode === 'edit' && initial ? initial.session_id : crypto.randomUUID();
    const startedIso = new Date(startedLocal).toISOString();
    const endedIso = new Date(endedLocal).toISOString();
    const date = format(new Date(startedIso), 'yyyy-MM-dd');

    setSaving(true);
    try {
      await setDoc(doc(db, `users/${userId}/sessions`, sessionId), {
        session_id: sessionId,
        userId,
        date,
        started_at: startedIso,
        ended_at: endedIso,
        planned_minutes: plannedMinutes,
        task: t,
        reflection: ref,
        rank: rank as 'A' | 'B' | 'C',
      });
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      setError('保存に失敗しました。ネットワークと権限を確認してください。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl border-rose-100 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-rose-700">
            {mode === 'create' ? '手動でセッションを追加' : 'セッションを編集'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'タイマーを付け忘れたとき用。開始・終了は実際の作業時間に合わせてください。'
              : '内容を修正して保存します。'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-1">
            <Label htmlFor="se-started" className="text-rose-800">
              開始（ローカル）
            </Label>
            <Input
              id="se-started"
              type="datetime-local"
              value={startedLocal}
              onChange={(e) => setStartedLocal(e.target.value)}
              className="border-rose-200"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="se-ended" className="text-rose-800">
              終了（ローカル）
            </Label>
            <Input
              id="se-ended"
              type="datetime-local"
              value={endedLocal}
              onChange={(e) => setEndedLocal(e.target.value)}
              className="border-rose-200"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="se-planned" className="text-rose-800">
              計画分数（記録用）
            </Label>
            <Input
              id="se-planned"
              type="number"
              min={1}
              max={120}
              value={plannedMinutes}
              onChange={(e) => setPlannedMinutes(Number(e.target.value))}
              className="border-rose-200"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="se-task" className="text-rose-800">
              タスク（1〜200 文字）
            </Label>
            <Input
              id="se-task"
              value={task}
              onChange={(e) => setTask(e.target.value.slice(0, 200))}
              maxLength={200}
              className="border-rose-200"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="se-ref" className="text-rose-800">
              振り返り（1〜200 文字・改行なし）
            </Label>
            <Textarea
              id="se-ref"
              value={reflection}
              onChange={handleReflectionChange}
              rows={3}
              maxLength={200}
              className="resize-none border-rose-200"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-rose-800">Rank</Label>
            <Select value={rank || undefined} onValueChange={(v) => setRank(v as 'A' | 'B' | 'C')}>
              <SelectTrigger className="border-rose-200">
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">A</SelectItem>
                <SelectItem value="B">B</SelectItem>
                <SelectItem value="C">C</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            キャンセル
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl"
          >
            {saving ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
