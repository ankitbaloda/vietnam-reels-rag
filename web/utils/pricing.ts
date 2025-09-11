// Simple per-model pricing map (USD per 1K tokens)
// NOTE: These are rough defaults. Update with your provider's latest pricing.
export type Pricing = {
  inputPer1K: number; // USD per 1K input tokens
  outputPer1K: number; // USD per 1K output tokens
};

const DEFAULT_PRICING: Pricing = { inputPer1K: 0.002, outputPer1K: 0.006 };

const MODEL_PRICING: Record<string, Pricing> = {
  // Examples; adjust as needed
  'gpt-4o-mini': { inputPer1K: 0.00015, outputPer1K: 0.00060 },
  'openai/gpt-4o-mini': { inputPer1K: 0.00015, outputPer1K: 0.00060 },
  'gpt-5-mini': { inputPer1K: 0.0002, outputPer1K: 0.0008 },
  'openrouter/gpt-5-mini': { inputPer1K: 0.0002, outputPer1K: 0.0008 },
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
