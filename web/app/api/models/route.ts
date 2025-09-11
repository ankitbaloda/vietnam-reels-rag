import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    // Try to connect to backend server
    const response = await fetch('http://server:8000/models', {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      throw new Error(`Backend returned ${response.status}`);
    }
  } catch (error) {
    console.warn('Backend unavailable, using fallback models');
    
    // Fallback models when backend is not available
    const fallbackData = {
      models: [
        'openai/gpt-5-mini',
        'openai/gpt-4o-mini', 
        'anthropic/claude-3-5-sonnet',
        'google/gemini-pro'
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

    return NextResponse.json(fallbackData);
  }
}