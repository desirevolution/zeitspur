export type SessionStatus = 'running' | 'paused' | 'pending' | 'completed';
export type Theme = 'system' | 'light' | 'dark';
export type LanguagePreference = 'auto' | 'de' | 'en';

export interface WorkSegment {
  start: number;
  end: number | null;
}

export interface Session {
  id: string;
  status: SessionStatus;
  startedAt: number;
  stoppedAt: number | null;
  segments: WorkSegment[];
  category: string | null;
  description: string | null;
  createdAt: number;
  updatedAt: number;
  revision: number;
}

export interface CategorySuggestion {
  name: string;
  lastUsedAt: number;
}

export interface Snapshot {
  sessions: Session[];
  activeSessionId: string | null;
  theme: Theme;
  language: LanguagePreference;
  categories: CategorySuggestion[];
  categoryListExpanded: boolean;
}

export interface DayEntry {
  session: Session;
  dayMs: number;
}

export interface DayGroup {
  key: string;
  durationMs: number;
  entries: DayEntry[];
}
