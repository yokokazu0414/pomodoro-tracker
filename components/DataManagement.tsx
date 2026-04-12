import React, { useRef, useState } from 'react';
import Papa from 'papaparse';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Firestore writeBatch の上限 */
const FIRESTORE_BATCH_LIMIT = 500;

const CSV_FIELDS = [
  'session_id',
  'userId',
  'date',
  'started_at',
  'ended_at',
  'planned_minutes',
  'task',
  'reflection',
  'rank',
] as const;

export function DataManagement() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = async () => {
    const user = auth.currentUser;
    if (!user) {
      setMessage({ type: 'error', text: 'You must be logged in to export data.' });
      return;
    }

    setIsExporting(true);
    try {
      const querySnapshot = await getDocs(collection(db, `users/${user.uid}/sessions`));
      const sessions = querySnapshot.docs.map((d) => d.data());

      const csv = Papa.unparse({
        fields: [...CSV_FIELDS],
        data: sessions.map((row) => {
          const o: Record<string, unknown> = {};
          for (const f of CSV_FIELDS) {
            o[f] = row[f] ?? '';
          }
          return o;
        }),
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `pomodoro_backup_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'Exported successfully.' });
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Failed to export data.' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const user = auth.currentUser;
    if (!user) {
      setMessage({ type: 'error', text: 'You must be logged in to import data.' });
      return;
    }

    setIsImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const data = results.data as Record<string, string>[];
          /** 同一 session_id が複数行ある場合は最後の行を採用（上書き方針と整合） */
          const bySessionId = new Map<string, Record<string, string>>();
          let duplicateRowCount = 0;
          for (const row of data) {
            const sid = row.session_id?.trim();
            if (!sid) continue;
            if (bySessionId.has(sid)) duplicateRowCount += 1;
            bySessionId.set(sid, row);
          }

          const rows: Array<{
            session_id: string;
            userId: string;
            date: string;
            started_at: string;
            ended_at: string;
            planned_minutes: number;
            task: string;
            reflection: string;
            rank: 'A' | 'B' | 'C';
          }> = [];

          for (const row of bySessionId.values()) {
            if (
              !row.session_id ||
              !row.date ||
              !row.started_at ||
              !row.ended_at ||
              row.planned_minutes === undefined ||
              row.planned_minutes === '' ||
              row.task === undefined ||
              row.task === '' ||
              row.reflection === undefined ||
              !row.rank
            ) {
              continue;
            }
            const pm = Number(row.planned_minutes);
            if (!Number.isFinite(pm) || pm <= 0) continue;
            const r = row.rank.trim();
            if (r !== 'A' && r !== 'B' && r !== 'C') continue;
            const taskT = row.task.trim();
            const reflT = row.reflection.trim();
            if (taskT.length < 1 || taskT.length > 200) continue;
            if (reflT.length < 1 || reflT.length > 200) continue;

            rows.push({
              session_id: row.session_id.trim(),
              userId: user.uid,
              date: row.date.trim(),
              started_at: row.started_at.trim(),
              ended_at: row.ended_at.trim(),
              planned_minutes: pm,
              task: taskT,
              reflection: reflT,
              rank: r as 'A' | 'B' | 'C',
            });
          }

          let written = 0;
          for (let i = 0; i < rows.length; i += FIRESTORE_BATCH_LIMIT) {
            const chunk = rows.slice(i, i + FIRESTORE_BATCH_LIMIT);
            const batch = writeBatch(db);
            for (const sessionData of chunk) {
              const docRef = doc(db, `users/${user.uid}/sessions`, sessionData.session_id);
              batch.set(docRef, sessionData, { merge: true });
              written += 1;
            }
            await batch.commit();
          }

          let msg = `Imported ${written} session(s).`;
          if (duplicateRowCount > 0) {
            msg += ` Duplicate session_id rows in CSV: last row per id was used (${duplicateRowCount} duplicate line(s)).`;
          }
          setMessage({ type: 'success', text: msg });
        } catch (error) {
          console.error(error);
          setMessage({ type: 'error', text: 'Failed to import data. Please check the CSV format.' });
        } finally {
          setIsImporting(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      },
      error: (error) => {
        console.error(error);
        setMessage({ type: 'error', text: 'Failed to parse CSV file.' });
        setIsImporting(false);
      },
    });
  };

  return (
    <div className="space-y-6 p-4">
      <Card className="border-rose-100 shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="text-rose-700">Data Management</CardTitle>
          <CardDescription>
            Export or import CSV. Sessions are stored in Firestore (cloud). Same session_id merges (overwrites) on import.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {message && (
            <div
              className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
            >
              {message.text}
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-rose-800">Export Data</Label>
            <p className="text-sm text-muted-foreground mb-2">Download all your sessions as a UTF-8 CSV (fixed column order).</p>
            <Button onClick={handleExport} disabled={isExporting} className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl">
              {isExporting ? 'Exporting...' : 'Export to CSV'}
            </Button>
          </div>

          <div className="space-y-2 pt-4 border-t border-rose-100">
            <Label className="text-rose-800">Import Data</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Upload a CSV. Large files are written in batches (500 ops). Duplicate session_id in the file: last row wins.
            </p>
            <Input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleImport}
              disabled={isImporting}
              className="max-w-sm border-rose-200 focus-visible:ring-rose-500"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
