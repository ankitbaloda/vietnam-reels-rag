export type StepId = 'ideation' | 'outline' | 'edl' | 'script' | 'suno' | 'handoff';

export type Role = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: Role;
  content: string;
  model?: string;
  ts: number;
  step?: StepId;
  citations?: Citation[];
  editCount?: number; // for user messages: number of times edited/regenerated
  // Optional graph + lifecycle fields for ChatGPT-like behaviors
  parentId?: string | null;
  rev?: number; // monotonically increasing on edit/regenerate
  state?: 'pending' | 'streaming' | 'committed' | 'error';
  meta?: {
    model?: string;
    tokens_in?: number;
    tokens_out?: number;
  };
}

export interface Session {
  id: string;
  name: string;
  createdAt: number;
  currentStep: StepId;
  messagesByStep: Record<StepId, Message[]>;
  autoRenamed?: boolean; // Track if session was already auto-renamed
}

export interface ModelItem {
  id: string;
  provider: string;
  label: string;
  free: boolean;
  paid: boolean;
  recommended?: boolean;
}

export interface Citation {
  source: string;
  title?: string;
  url?: string;
  excerpt?: string;
}

export interface FinalEntry {
  id: string;
  content: string;
  model?: string;
  ts: number;
}

export interface UsageStat {
  promptTokens?: number;
  completionTokens?: number;
  contextTokens?: number;
}

export interface ChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

export interface RAGResponse extends ChatResponse {
  citations?: Citation[];
}

export interface PipelineResponse {
  status: string;
  out_dir?: string;
  file?: string;
  content: string;
}

export interface HistoryResponse {
  session_id: string;
  step?: StepId;
  messages: Array<{
    role: Role;
    content: string;
    model?: string;
    ts: number;
    step?: StepId;
  }>;
}

export type CoverageCategory = 'Playbook' | 'Daywise Narrations' | 'Costs' | 'Style Guide' | 'Travel Files' | 'Other';