// Simple per-model pricing map (USD per 10K tokens)
// NOTE: These are rough defaults. Update with your provider's latest pricing.
export type Pricing = {
  inputPer10K: number; // USD per 10K input tokens
  outputPer10K: number; // USD per 10K output tokens
};

const DEFAULT_PRICING: Pricing = { inputPer10K: 0.02, outputPer10K: 0.06 };

const MODEL_PRICING: Record<string, Pricing> = {
  // OpenAI GPT-4 Models
  'gpt-4o-mini': { inputPer10K: 0.0015, outputPer10K: 0.006 },
  'openai/gpt-4o-mini': { inputPer10K: 0.0015, outputPer10K: 0.006 },
  'gpt-4o': { inputPer10K: 0.05, outputPer10K: 0.15 },
  'openai/gpt-4o': { inputPer10K: 0.05, outputPer10K: 0.15 },
  
  // OpenAI GPT-5 Models (2025)
  'gpt-5': { inputPer10K: 0.01, outputPer10K: 0.04 },
  'openai/gpt-5': { inputPer10K: 0.01, outputPer10K: 0.04 },
  'gpt-5-mini': { inputPer10K: 0.002, outputPer10K: 0.008 },
  'openai/gpt-5-mini': { inputPer10K: 0.002, outputPer10K: 0.008 },
  'openrouter/gpt-5-mini': { inputPer10K: 0.002, outputPer10K: 0.008 },
  'gpt-5-chat': { inputPer10K: 0.003, outputPer10K: 0.012 },
  'gpt-5-nano': { inputPer10K: 0.001, outputPer10K: 0.004 },

  // Anthropic Claude Models (2025)
  'claude-3-5-sonnet': { inputPer10K: 0.03, outputPer10K: 0.15 },
  'anthropic/claude-3-5-sonnet': { inputPer10K: 0.03, outputPer10K: 0.15 },
  'claude-3-5-haiku': { inputPer10K: 0.008, outputPer10K: 0.04 },
  'anthropic/claude-3-5-haiku': { inputPer10K: 0.008, outputPer10K: 0.04 },
  'claude-3-opus': { inputPer10K: 0.15, outputPer10K: 0.75 },
  'claude-3-sonnet': { inputPer10K: 0.03, outputPer10K: 0.15 },
  'claude-3-haiku': { inputPer10K: 0.0025, outputPer10K: 0.0125 },

  // Google Gemini Models (2025)
  'gemini-2.0-flash': { inputPer10K: 0.002, outputPer10K: 0.008 },
  'google/gemini-2.0-flash': { inputPer10K: 0.002, outputPer10K: 0.008 },
  'gemini-1.5-pro': { inputPer10K: 0.035, outputPer10K: 0.105 },
  'google/gemini-1.5-pro': { inputPer10K: 0.035, outputPer10K: 0.105 },
  'gemini-1.5-flash': { inputPer10K: 0.00075, outputPer10K: 0.003 },

  // xAI Grok Models (2025)
  'grok-2': { inputPer10K: 0.02, outputPer10K: 0.10 },
  'xai/grok-2': { inputPer10K: 0.02, outputPer10K: 0.10 },
  'grok-beta': { inputPer10K: 0.05, outputPer10K: 0.15 },

  // Meta Llama Models (2025)
  'llama-3.1-405b-instruct': { inputPer10K: 0.03, outputPer10K: 0.15 },
  'meta-llama/llama-3.1-405b-instruct': { inputPer10K: 0.03, outputPer10K: 0.15 },
  'llama-3.1-70b-instruct': { inputPer10K: 0.009, outputPer10K: 0.009 },
  'llama-3.1-8b-instruct': { inputPer10K: 0.002, outputPer10K: 0.002 },
  
  // Mistral Models
  'mistral-large': { inputPer10K: 0.04, outputPer10K: 0.12 },
  'mistral/mistral-large': { inputPer10K: 0.04, outputPer10K: 0.12 },
  'mistral-medium': { inputPer10K: 0.0275, outputPer10K: 0.0825 },
  
  // Cohere Models
  'command-r-plus': { inputPer10K: 0.03, outputPer10K: 0.15 },
  'cohere/command-r-plus': { inputPer10K: 0.03, outputPer10K: 0.15 },
  'command-r': { inputPer10K: 0.005, outputPer10K: 0.015 },
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
  const promptUSD = (p / 10000) * pricing.inputPer10K;
  const completionUSD = (c / 10000) * pricing.outputPer10K;
  return { promptUSD, completionUSD, totalUSD: promptUSD + completionUSD };
}

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): { inputCost: number; outputCost: number; totalCost: number } {
  const pricing = MODEL_PRICING[model];
  
  if (!pricing) {
    // Return zero costs for unknown models
    return { inputCost: 0, outputCost: 0, totalCost: 0 };
  }

  const inputCost = (inputTokens / 10000) * pricing.inputPer10K;
  const outputCost = (outputTokens / 10000) * pricing.outputPer10K;
  const totalCost = inputCost + outputCost;

  return { inputCost, outputCost, totalCost };
}
