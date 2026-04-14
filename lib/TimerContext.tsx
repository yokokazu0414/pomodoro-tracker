import React, { createContext, useContext, useState, useEffect } from 'react';

type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

interface TimerState {
  status: TimerStatus;
  plannedMinutes: number;
  timeLeft: number;
  task: string;
  startedAt: string | null;
  sessionId: string | null;
  targetEndTime: number | null;
  /** タイマーが 0 になった瞬間／早期終了クリック時。振り返りモーダル入力の遅れを ended_at に含めない */
  workEndedAt: string | null;
}

interface TimerContextType extends TimerState {
  setPlannedMinutes: (minutes: number) => void;
  setTask: (task: string) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  finishTimer: () => void;
  finishEarly: () => void;
  clearSession: () => void;
}

const defaultState: TimerState = {
  status: 'idle',
  plannedMinutes: 25,
  timeLeft: 25 * 60,
  task: '',
  startedAt: null,
  sessionId: null,
  targetEndTime: null,
  workEndedAt: null,
};

const STORAGE_KEY = 'pomodoro_timer_state';

function loadState(): TimerState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<TimerState>;
      const merged = { ...defaultState, ...parsed, workEndedAt: parsed.workEndedAt ?? null } as TimerState;

      if (merged.status === 'running' && merged.targetEndTime) {
        const now = Date.now();
        const remaining = Math.max(0, Math.round((merged.targetEndTime - now) / 1000));
        if (remaining === 0) {
          return {
            ...merged,
            status: 'finished',
            timeLeft: 0,
            targetEndTime: null,
            workEndedAt: new Date().toISOString(),
          };
        } else {
          return { ...merged, timeLeft: remaining };
        }
      }
      return merged;
    }
  } catch (e) {
    console.error('Failed to parse timer state', e);
  }
  return defaultState;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<TimerState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (state.status === 'running' && state.targetEndTime) {
      const interval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.round((state.targetEndTime! - now) / 1000));
        
        if (remaining <= 0) {
          clearInterval(interval);
          const endIso = new Date().toISOString();
          setState(prev => ({
            ...prev,
            status: 'finished',
            timeLeft: 0,
            targetEndTime: null,
            workEndedAt: endIso,
          }));
        } else {
          setState(prev => ({ ...prev, timeLeft: remaining }));
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state.status, state.targetEndTime]);

  const setPlannedMinutes = (minutes: number) => {
    setState(prev => ({
      ...prev,
      plannedMinutes: minutes,
      timeLeft: prev.status === 'idle' ? minutes * 60 : prev.timeLeft
    }));
  };

  const setTask = (task: string) => {
    setState(prev => ({ ...prev, task }));
  };

  const startTimer = () => {
    setState(prev => {
      if (prev.status !== 'idle') return prev;
      const startedAt = new Date().toISOString();
      const sessionId = crypto.randomUUID();
      const targetEndTime = Date.now() + prev.timeLeft * 1000;
      return { ...prev, status: 'running', startedAt, sessionId, targetEndTime, workEndedAt: null };
    });
  };

  const pauseTimer = () => {
    setState(prev => ({ ...prev, status: 'paused', targetEndTime: null }));
  };

  const resumeTimer = () => {
    setState(prev => {
      const targetEndTime = Date.now() + prev.timeLeft * 1000;
      return { ...prev, status: 'running', targetEndTime };
    });
  };

  const resetTimer = () => {
    setState(prev => ({
      ...prev,
      status: 'idle',
      timeLeft: prev.plannedMinutes * 60,
      startedAt: null,
      sessionId: null,
      targetEndTime: null,
      workEndedAt: null,
    }));
  };

  const finishTimer = () => {
    setState(prev => ({
      ...prev,
      status: 'finished',
      timeLeft: 0,
      targetEndTime: null,
      workEndedAt: new Date().toISOString(),
    }));
  };

  const finishEarly = () => {
    setState(prev => ({
      ...prev,
      status: 'finished',
      targetEndTime: null,
      workEndedAt: new Date().toISOString(),
    }));
  };

  const clearSession = () => {
    setState(prev => ({
      ...prev,
      status: 'idle',
      timeLeft: prev.plannedMinutes * 60,
      task: '',
      startedAt: null,
      sessionId: null,
      targetEndTime: null,
      workEndedAt: null,
    }));
  };

  return (
    <TimerContext.Provider
      value={{
        ...state,
        setPlannedMinutes,
        setTask,
        startTimer,
        pauseTimer,
        resumeTimer,
        resetTimer,
        finishTimer,
        finishEarly,
        clearSession,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (context === undefined) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
};
