import { Session, FinalEntry, UsageStat, StepId } from '../types';

// Simple DJB2 hash function for generating IDs
export function hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash).toString(36);
}

// Generate UUID-like string
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Safe JSON parse with fallback
function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

// Sessions management
export function loadSessions(): Session[] {
  if (typeof window === 'undefined') return [];
  const sessions = localStorage.getItem('sessions');
  return safeJsonParse(sessions, []);
}

export function saveSessions(sessions: Session[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('sessions', JSON.stringify(sessions));
}

// Finals management
export function loadFinals(): Record<string, Record<StepId, FinalEntry[]>> {
  if (typeof window === 'undefined') return {};
  const finals = localStorage.getItem('finals');
  return safeJsonParse(finals, {});
}

export function saveFinals(finals: Record<string, Record<StepId, FinalEntry[]>>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('finals', JSON.stringify(finals));
}

// Usage stats management
export function loadUsage(): Record<string, UsageStat> {
  if (typeof window === 'undefined') return {};
  const usage = localStorage.getItem('usage');
  return safeJsonParse(usage, {});
}

export function saveUsage(usage: Record<string, UsageStat>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('usage', JSON.stringify(usage));
}

// Helper to create a new session
export function createNewSession(name?: string): Session {
  const id = generateId();
  return {
    id,
    name: name || 'New Chat',
    createdAt: Date.now(),
    currentStep: 'ideation',
    messagesByStep: {
      ideation: [],
      outline: [],
      edl: [],
      script: [],
      suno: [],
      handoff: []
    }
  };
}

// Helper to create a final entry
export function createFinalEntry(content: string, model?: string): FinalEntry {
  return {
    id: hash(content),
    content,
    model,
    ts: Date.now()
  };
}