import { 
  ChatResponse, 
  RAGResponse, 
  PipelineResponse, 
  HistoryResponse, 
  ModelItem, 
  StepId, 
  Message 
} from '../types';

// API base functions with better error handling
async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const maxRetries = 3;
  const baseDelay = 1000;
  let attempt = 0;
  
  // Use correct API base URL - server runs on port 8000
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
  
  
  while (attempt <= maxRetries) {
    try {
      const response = await fetch(`${apiBase}${endpoint}`, {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        timeout: 120000, // 2 minutes
        ...options,
      });

      if (!response.ok) {
        // Extract error details
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.detail) errorMessage = errorData.detail;
          else if (errorData.error) errorMessage = errorData.error;
          else if (errorData.message) errorMessage = errorData.message;
        } catch {
          // Use status text if JSON parsing fails
        }
        
        // Retry on server errors
        if (response.status >= 500 && attempt < maxRetries) {
          attempt++;
          await new Promise(resolve => setTimeout(resolve, baseDelay * attempt));
          continue;
        }
        
        throw new Error(errorMessage);
      }

      return response.json() as T;
    } catch (error) {
      if (attempt >= maxRetries) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error('Backend server is not responding. Please ensure the FastAPI server is running on port 8000.');
        }
        throw error;
      }
      
      attempt++;
      await new Promise(resolve => setTimeout(resolve, baseDelay * attempt));
    }
  }
  
  throw new Error('Max retries exceeded');
}

// Models API
export async function fetchModels(): Promise<{ models: string[]; items: ModelItem[] }> {
  try {
    const data = await apiCall<{ models: string[]; items: ModelItem[] }>('/models');
  } catch (error) {
    console.warn('Backend unavailable, using fallback models:', error);
    // Provide comprehensive fallback models
    return {
      models: [
        'openai/gpt-5-mini', 'openai/gpt-4o-mini', 'openai/gpt-4o',
        'anthropic/claude-3-5-sonnet', 'anthropic/claude-3-5-haiku',
        'google/gemini-pro', 'google/gemini-flash'
      ],
      items: [
        {
          id: 'openai/gpt-5-mini',
          provider: 'OpenAI',
          label: 'GPT-5 Mini',
          free: true,
          paid: false,
          recommended: true
        },
        {
          id: 'openai/gpt-4o-mini',
          provider: 'OpenAI',
          label: 'GPT-4o Mini',
          free: false,
          paid: true,
          recommended: true
        },
        {
          id: 'anthropic/claude-3-5-sonnet',
          provider: 'Anthropic',
          label: 'Claude 3.5 Sonnet',
          free: false,
          paid: true,
          recommended: true
        },
        {
          id: 'google/gemini-pro',
          provider: 'Google',
          label: 'Gemini Pro',
          free: false,
          paid: true,
          recommended: false
        }
      ]
    };
  }
}

// Chat API
export async function sendChatMessage(params: {
  model: string;
  messages: Array<{role: string; content: string}>;
  temperature?: number;
  session_id?: string;
  step?: StepId;
}): Promise<ChatResponse> {
  return apiCall('/chat', {
    method: 'POST',
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      temperature: params.temperature || 0.7,
      session_id: params.session_id,
      step: params.step,
    }),
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
}): Promise<RAGResponse> {
  return apiCall('/rag/chat', {
    method: 'POST',
    body: JSON.stringify({
      query: params.query,
      model: params.model,
      top_k: params.top_k || 8,
      temperature: params.temperature || 0.7,
      session_id: params.session_id,
      step: params.step,
    }),
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

// Health check
export async function checkBackendHealth(): Promise<{ status: string; service: string }> {
  return apiCall('/health');
}