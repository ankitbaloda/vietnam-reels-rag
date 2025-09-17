import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Get backend URL from environment or fallback to localhost
    const backendUrl = process.env.NEXT_PUBLIC_RAG_ENDPOINT || 'http://localhost:8000';
    
    // Try to forward to backend first
    try {
      const response = await fetch(`${backendUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      } else {
        throw new Error(`Backend returned ${response.status}`);
      }
    } catch (backendError) {
      console.log('Backend unavailable, trying OpenAI directly:', backendError);
      
      // Fallback to OpenAI API directly
      const openaiApiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
      const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://api.openai.com/v1';
      
      if (!openaiApiKey) {
        throw new Error('No API key available');
      }

      const openaiResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:3002',
          'X-Title': process.env.OPENROUTER_APP_NAME || 'Vietnam Reels RAG',
        },
        body: JSON.stringify({
          model: body.model || 'gpt-4o-mini',
          messages: body.messages || [],
          temperature: body.temperature || 0.7,
          max_tokens: 4000,
        }),
      });

      if (openaiResponse.ok) {
        const data = await openaiResponse.json();
        return NextResponse.json(data);
      } else {
        const errorText = await openaiResponse.text();
        throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`);
      }
    }
  } catch (error) {
    console.error('Chat API error:', error);
    
    // Return a helpful error response
    return NextResponse.json({
      choices: [{
        message: {
          content: `I'm sorry, I'm currently unable to respond. ${error instanceof Error ? error.message : 'Please check your API configuration and try again.'}`
        }
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0
      }
    }, { status: 500 });
  }
}