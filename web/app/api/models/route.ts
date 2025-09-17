import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_RAG_ENDPOINT || 'http://localhost:8000';
    const response = await fetch(`${backendUrl}/models`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }
  } catch (error) {
    console.warn('Backend unavailable, using fallback models');
  }
  
  // Fallback models
  return NextResponse.json({
    models: [
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-sonnet',
      'google/gemini-1.5-pro',
      'meta-llama/llama-3.1-405b-instruct'
    ],
    items: [
      { id: 'openai/gpt-4o-mini', provider: 'OpenAI', label: 'GPT-4o Mini', recommended: true },
      { id: 'anthropic/claude-3.5-sonnet', provider: 'Anthropic', label: 'Claude 3.5 Sonnet', recommended: true },
      { id: 'google/gemini-1.5-pro', provider: 'Google', label: 'Gemini 1.5 Pro', recommended: true },
      { id: 'meta-llama/llama-3.1-405b-instruct', provider: 'Meta', label: 'Llama 3.1 405B', recommended: false }
    ]
  });
}
