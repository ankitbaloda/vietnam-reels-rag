// Token estimation utilities for different model families

/**
 * Estimate token count for text based on model family
 * This is an approximation - for exact counts, use model-specific tokenizers
 */

export function estimateTokenCount(text: string, modelId?: string): number {
  if (!text) return 0;
  
  // Determine model family from model ID
  const isGPT = modelId?.toLowerCase().includes('gpt') || false;
  const isClaude = modelId?.toLowerCase().includes('claude') || false;
  const isGemini = modelId?.toLowerCase().includes('gemini') || false;
  
  // Different tokenization strategies based on model family
  if (isGPT) {
    // GPT models (more accurate estimation)
    // GPT tokenizers typically have ~3-4 characters per token on average
    // But this varies significantly based on content type
    return estimateGPTTokens(text);
  } else if (isClaude) {
    // Claude models (Anthropic uses a different tokenizer)
    // Generally similar to GPT but slightly different
    return estimateClaudeTokens(text);
  } else if (isGemini) {
    // Gemini models (Google's tokenizer)
    return estimateGeminiTokens(text);
  } else {
    // Default fallback
    return estimateGPTTokens(text);
  }
}

function estimateGPTTokens(text: string): number {
  // More sophisticated estimation for GPT models
  // Based on OpenAI's tokenizer patterns
  
  // Count different types of content
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  const charCount = text.length;
  const newlineCount = (text.match(/\n/g) || []).length;
  const punctuationCount = (text.match(/[.,!?;:()[\]{}'"]/g) || []).length;
  
  // Estimate based on content characteristics
  // - English words: ~0.75 tokens per word on average
  // - Punctuation: ~1 token per punctuation mark
  // - Newlines: ~1 token per newline
  // - Special characters and spaces: factored into word estimation
  
  let estimatedTokens = Math.ceil(wordCount * 0.75);
  estimatedTokens += punctuationCount;
  estimatedTokens += newlineCount;
  
  // Add buffer for special tokens and edge cases
  estimatedTokens = Math.ceil(estimatedTokens * 1.1);
  
  // Fallback to character-based estimation if word-based seems off
  const charBasedEstimate = Math.ceil(charCount / 3.5);
  
  // Use the higher of the two estimates for safety
  return Math.max(estimatedTokens, charBasedEstimate);
}

function estimateClaudeTokens(text: string): number {
  // Claude tokenizer is similar to GPT but with some differences
  // Generally slightly more efficient
  const gptEstimate = estimateGPTTokens(text);
  return Math.ceil(gptEstimate * 0.95); // Slightly fewer tokens than GPT
}

function estimateGeminiTokens(text: string): number {
  // Gemini uses SentencePiece tokenizer
  // Generally more efficient than GPT tokenizer
  const gptEstimate = estimateGPTTokens(text);
  return Math.ceil(gptEstimate * 0.85); // Notably fewer tokens than GPT
}

/**
 * Estimate token count for a conversation (array of messages)
 */
export function estimateConversationTokens(messages: Array<{role: string, content: string}>, modelId?: string): {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
} {
  let inputTokens = 0;
  let outputTokens = 0;
  
  for (const message of messages) {
    const tokens = estimateTokenCount(message.content, modelId);
    
    if (message.role === 'user' || message.role === 'system') {
      inputTokens += tokens;
    } else if (message.role === 'assistant') {
      outputTokens += tokens;
    }
  }
  
  // Add overhead for conversation structure
  // Most APIs add some overhead tokens for message formatting
  const overheadPerMessage = messages.length * 3; // ~3 tokens per message for formatting
  inputTokens += overheadPerMessage;
  
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens
  };
}

/**
 * Estimate tokens for a single message with system prompt
 */
export function estimatePromptTokens(systemPrompt: string, userMessage: string, modelId?: string): number {
  const systemTokens = estimateTokenCount(systemPrompt, modelId);
  const userTokens = estimateTokenCount(userMessage, modelId);
  
  // Add overhead for message structure
  const overhead = 10; // Format overhead
  
  return systemTokens + userTokens + overhead;
}