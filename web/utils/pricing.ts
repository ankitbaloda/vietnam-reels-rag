// Simple per-model pricing map (USD per 1K tokens)
// NOTE: These are rough defaults. Update with your provider's latest pricing.
export type Pricing = {
  inputPer1K: number; // USD per 1K input tokens
  outputPer1K: number; // USD per 1K output tokens
};

const DEFAULT_PRICING: Pricing = { inputPer1K: 0.002, outputPer1K: 0.006 };

const MODEL_PRICING: Record<string, Pricing> = {
  // OpenAI GPT-4 Models
  'gpt-4o-mini': { inputPer1K: 0.00015, outputPer1K: 0.00060 },
  'openai/gpt-4o-mini': { inputPer1K: 0.00015, outputPer1K: 0.00060 },
  'gpt-4o': { inputPer1K: 0.005, outputPer1K: 0.015 },
  'openai/gpt-4o': { inputPer1K: 0.005, outputPer1K: 0.015 },
  
  // OpenAI GPT-5 Models (2025)
  'gpt-5': { inputPer1K: 0.001, outputPer1K: 0.004 },
  'openai/gpt-5': { inputPer1K: 0.001, outputPer1K: 0.004 },
  'gpt-5-mini': { inputPer1K: 0.0002, outputPer1K: 0.0008 },
  'openai/gpt-5-mini': { inputPer1K: 0.0002, outputPer1K: 0.0008 },
  'openrouter/gpt-5-mini': { inputPer1K: 0.0002, outputPer1K: 0.0008 },
  'gpt-5-chat': { inputPer1K: 0.0003, outputPer1K: 0.0012 },
  'gpt-5-nano': { inputPer1K: 0.0001, outputPer1K: 0.0004 },

  // Anthropic Claude Models (2025)
  'claude-3-5-sonnet': { inputPer1K: 0.003, outputPer1K: 0.015 },
  'anthropic/claude-3-5-sonnet': { inputPer1K: 0.003, outputPer1K: 0.015 },
  'claude-3-5-haiku': { inputPer1K: 0.0008, outputPer1K: 0.004 },
  'anthropic/claude-3-5-haiku': { inputPer1K: 0.0008, outputPer1K: 0.004 },
  'claude-3-opus': { inputPer1K: 0.015, outputPer1K: 0.075 },
  'claude-3-sonnet': { inputPer1K: 0.003, outputPer1K: 0.015 },
  'claude-3-haiku': { inputPer1K: 0.00025, outputPer1K: 0.00125 },

  // Google Gemini Models (2025)
  'gemini-2.0-flash': { inputPer1K: 0.0002, outputPer1K: 0.0008 },
  'google/gemini-2.0-flash': { inputPer1K: 0.0002, outputPer1K: 0.0008 },
  'gemini-1.5-pro': { inputPer1K: 0.0035, outputPer1K: 0.0105 },
  'google/gemini-1.5-pro': { inputPer1K: 0.0035, outputPer1K: 0.0105 },
  'gemini-1.5-flash': { inputPer1K: 0.000075, outputPer1K: 0.0003 },

  // xAI Grok Models (2025)
  'grok-2': { inputPer1K: 0.002, outputPer1K: 0.010 },
  'xai/grok-2': { inputPer1K: 0.002, outputPer1K: 0.010 },
  'grok-beta': { inputPer1K: 0.005, outputPer1K: 0.015 },

  // Meta Llama Models (2025)
  'llama-3.1-405b-instruct': { inputPer1K: 0.003, outputPer1K: 0.015 },
  'meta-llama/llama-3.1-405b-instruct': { inputPer1K: 0.003, outputPer1K: 0.015 },
  'llama-3.1-70b-instruct': { inputPer1K: 0.0009, outputPer1K: 0.0009 },
  'llama-3.1-8b-instruct': { inputPer1K: 0.0002, outputPer1K: 0.0002 },
  
  // Mistral Models
  'mistral-large': { inputPer1K: 0.004, outputPer1K: 0.012 },
  'mistral/mistral-large': { inputPer1K: 0.004, outputPer1K: 0.012 },
  'mistral-medium': { inputPer1K: 0.00275, outputPer1K: 0.00825 },
  
  // Cohere Models
  'command-r-plus': { inputPer1K: 0.003, outputPer1K: 0.015 },
  'cohere/command-r-plus': { inputPer1K: 0.003, outputPer1K: 0.015 },
  'command-r': { inputPer1K: 0.0005, outputPer1K: 0.0015 },
};

export function getModelPricing(modelId?: string): Pricing {
  if (!modelId) return DEFAULT_PRICING;
  return MODEL_PRICING[modelId] || DEFAULT_PRICING;
}

export function estimateCostUSD(tokens: { promptTokens?: number; completionTokens?: number }, modelId?: string): {
  promptUSD: number;
  completionUSD: number;
  totalUSD: number;
} {
  const pricing = getModelPricing(modelId);
  const p = tokens.promptTokens || 0;
  const c = tokens.completionTokens || 0;
  const promptUSD = (p / 1000) * pricing.inputPer1K;
  const completionUSD = (c / 1000) * pricing.outputPer1K;
  return { promptUSD, completionUSD, totalUSD: promptUSD + completionUSD };
}
