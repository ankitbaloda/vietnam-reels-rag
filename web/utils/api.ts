import { 
  ChatResponse, 
  RAGResponse, 
  PipelineResponse, 
  HistoryResponse, 
  ModelItem, 
  StepId, 
  Message 
} from '../types';

// API base functions
async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const maxRetries = 2;
  const baseDelay = 250;
  let attempt = 0;
  while (true) {
    try {
      console.log(`Making API call to: /api${endpoint}`);
      const response = await fetch(`/api${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

      console.log(`API response status: ${response.status}`);
      if (!response.ok) {
        // Retry policy for 429 and 5xx
        const retryAfter = Number(response.headers.get('Retry-After') || '0');
        if ((response.status === 429 || (response.status >= 500 && response.status < 600)) && attempt < maxRetries) {
          const delay = retryAfter > 0 ? retryAfter * 1000 : baseDelay * Math.pow(2, attempt);
          console.log('Error response data:', errorData);
          await new Promise(r => setTimeout(r, delay));
          attempt++;
          console.log(`Retrying API call, attempt ${attempt}`);
          continue;
        }
      // Try to extract structured error info
      let msg = `API call failed: ${response.status} ${response.statusText}`;
      try {
        const data = await response.json();
        const parts: string[] = [];
        if (data.error) parts.push(String(data.error));
        if (data.message) parts.push(String(data.message));
        if (data.detail) parts.push(String(data.detail));
        if (data.hint) parts.push(`Hint: ${String(data.hint)}`);
        if (data.provider) parts.push(`Provider: ${String(data.provider)}`);
        if (data.model) parts.push(`Model: ${String(data.model)}`);
        if (parts.length) msg = parts.join(' | ');
      } catch {
        try {
          const text = await response.text();
          if (text) msg = `${msg} | ${text.slice(0, 500)}`;
        } catch {
          // ignore
        }
        }
        throw new Error(msg);
      }

      return response.json();
    } catch (error) {
      console.error(`API call attempt ${attempt} failed:`, error);
      // If it's a network error or server unavailable, provide fallback / retry
      const err = error as Error;
      if (err instanceof TypeError && err.message.includes('fetch') && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        attempt++;
        continue;
      }
      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new Error('Backend server unavailable');
      }
      throw err;
    }
  }
}

// Models API
export async function fetchModels(): Promise<{ models: string[]; items: ModelItem[] }> {
  try {
    const data = await apiCall('/models');
    return data;
  } catch (error) {
    // Provide fallback models when backend is unavailable
    console.warn('Backend unavailable, using fallback models:', error);
    return {
      models: ['openrouter/gpt-5-mini', 'openrouter/gpt-4o-mini', 'openrouter/claude-3-5-sonnet'],
      items: [
        {
          id: 'openrouter/gpt-5-mini',
          provider: 'OpenAI',
          label: 'GPT-5 Mini',
          free: true,
          paid: false,
          recommended: true
        },
        {
          id: 'openrouter/gpt-4o-mini',
          provider: 'OpenAI',
          label: 'GPT-4o Mini',
          free: false,
          paid: true,
          recommended: true
        },
        {
          id: 'openrouter/claude-3-5-sonnet',
          provider: 'Anthropic',
          label: 'Claude 3.5 Sonnet',
          free: false,
          paid: true,
          recommended: true
        }
      ]
    };
  }
}

// Chat API
export async function sendChatMessage(params: {
  model: string;
  messages: Message[];
  temperature?: number;
  session_id?: string;
  step?: StepId;
  // streaming disabled in backend for now; signal allows Stop
  signal?: AbortSignal;
  idempotencyKey?: string;
}): Promise<ChatResponse> {
  return apiCall('/chat', {
    method: 'POST',
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      temperature: params.temperature,
      session_id: params.session_id,
      step: params.step,
      // backend supports non-streaming JSON; keep consistent
      stream: false,
    }),
    signal: params.signal,
    headers: params.idempotencyKey ? { 'Idempotency-Key': params.idempotencyKey } : undefined,
  });
}

// RAG Chat API
export async function sendRAGQuery(params: {
  query: string;
  model: string;
  top_k?: number;
  temperature?: number;
  session_id?: string;
  step?: StepId;
  signal?: AbortSignal;
  idempotencyKey?: string;
}): Promise<RAGResponse> {
  return apiCall('/rag/chat', {
    method: 'POST',
    body: JSON.stringify({
      query: params.query,
      model: params.model,
      top_k: params.top_k,
      temperature: params.temperature,
      session_id: params.session_id,
      step: params.step,
    }),
    signal: params.signal,
    headers: params.idempotencyKey ? { 'Idempotency-Key': params.idempotencyKey } : undefined,
  });
}

// Pipeline APIs
export async function runPipelineStep(
  step: StepId,
  params: {
    topic?: string;
    trip?: string;
    persona?: string;
    prompt?: string;
    outline?: string;
    edl?: string;
    script?: string;
    suno?: string;
    top_k?: number;
    model?: string;
    temperature?: number;
    session_id?: string;
    step?: StepId;
  }
): Promise<PipelineResponse> {
  return apiCall(`/pipeline/${step}`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// History API
export async function fetchHistory(params: {
  session_id: string;
  step?: StepId;
  limit?: number;
}): Promise<HistoryResponse> {
  const searchParams = new URLSearchParams();
  searchParams.append('session_id', params.session_id);
  if (params.step) searchParams.append('step', params.step);
  if (params.limit) searchParams.append('limit', params.limit.toString());
  
  return apiCall(`/history?${searchParams.toString()}`);
}