import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Try backend first, then fallback to OpenAI directly
    try {
      const backendResponse = await fetch('http://localhost:8000/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });

      if (backendResponse.ok && backendResponse.body) {
        return new NextResponse(backendResponse.body, {
          headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } else {
        throw new Error('Backend not available');
      }
    } catch (backendError) {
      console.log('Backend unavailable, using OpenAI directly:', backendError);
      
      // Fallback to OpenAI streaming
      const openaiApiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
      const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://api.openai.com/v1';
      
      if (!openaiApiKey) {
        throw new Error('No API key configured');
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
          stream: true,
        }),
      });

      if (!openaiResponse.ok) {
        throw new Error(`OpenAI API error: ${openaiResponse.status}`);
      }

      // Convert OpenAI stream to our format
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const reader = openaiResponse.body?.getReader();
            if (!reader) throw new Error('No response body');

            let buffer = '';
            let totalUsage = { prompt_tokens: 0, completion_tokens: 0 };
            
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                  try {
                    const data = JSON.parse(line.slice(6));
                    const delta = data.choices?.[0]?.delta?.content;
                    if (delta) {
                      controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify({ delta })}\n\n`));
                    }
                    
                    // Handle usage data
                    if (data.usage) {
                      totalUsage.prompt_tokens = data.usage.prompt_tokens || 0;
                      totalUsage.completion_tokens = data.usage.completion_tokens || 0;
                    }
                    
                    if (data.choices?.[0]?.finish_reason) {
                      // Send usage data before finish
                      if (totalUsage.prompt_tokens > 0 || totalUsage.completion_tokens > 0) {
                        controller.enqueue(encoder.encode(`event: usage\ndata: ${JSON.stringify(totalUsage)}\n\n`));
                      }
                      controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ finish_reason: data.choices[0].finish_reason })}\n\n`));
                    }
                  } catch (e) {
                    console.warn('Failed to parse OpenAI stream line:', line);
                  }
                }
              }
            }

            controller.close();
          } catch (error) {
            console.error('Stream processing error:', error);
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Stream processing failed' })}\n\n`));
            controller.close();
          }
        }
      });

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }
  } catch (error) {
    console.error('Chat stream API error:', error);
    
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const message = `I'm having trouble processing your request: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your API configuration.`;
        controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify({ delta: message })}\n\n`));
        controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ finish_reason: "error" })}\n\n`));
        controller.close();
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }
}