import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Starting models API request`);
  
  try {
    // Try to connect to backend server
    const backendUrl = `http://server:8000/models?t=${Date.now()}`;
    console.log('Attempting to fetch from backend:', backendUrl);
    const response = await fetch(backendUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
      // Add timeout and retry logic
      signal: AbortSignal.timeout(5000),
      cache: 'no-store', // Disable caching
    });

    console.log('Backend response status:', response.status);
    console.log('Backend response ok:', response.ok);

    if (response.ok) {
      const data = await response.json();
      console.log('Raw backend data keys:', Object.keys(data));
      console.log('Models array length:', data.models?.length || 0);
      console.log('Items array length:', data.items?.length || 0);
      console.log('First few models:', data.models?.slice(0, 5));
      console.log('Successfully fetched models from backend:', data.models?.length || 0, 'models');
      return NextResponse.json(data, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    } else {
      console.warn(`Backend returned ${response.status}, using fallback models`);
      throw new Error(`Backend returned ${response.status}`);
    }
  } catch (error) {
    console.warn('Backend unavailable, using fallback models:', error);
    
    // Fallback models when backend is not available - Updated 2025 models
    const fallbackData = {
      models: [
        'openai/gpt-5-mini',
        'openai/gpt-4o-mini', 
        'anthropic/claude-3-5-sonnet',
        'anthropic/claude-3-5-haiku',
        'google/gemini-2.0-flash',
        'xai/grok-2',
        'meta-llama/llama-3.1-405b-instruct'
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
          id: 'anthropic/claude-3-5-haiku',
          provider: 'Anthropic',
          label: 'Claude 3.5 Haiku',
          free: false,
          paid: true,
          recommended: false
        },
        {
          id: 'google/gemini-2.0-flash',
          provider: 'Google',
          label: 'Gemini 2.0 Flash',
          free: false,
          paid: true,
          recommended: true
        },
        {
          id: 'xai/grok-2',
          provider: 'xAI',
          label: 'Grok-2',
          free: false,
          paid: true,
          recommended: false
        },
        {
          id: 'meta-llama/llama-3.1-405b-instruct',
          provider: 'Meta',
          label: 'Llama 3.1 405B Instruct',
          free: false,
          paid: true,
          recommended: false
        }
      ]
    };

    return NextResponse.json(fallbackData);
  }
}