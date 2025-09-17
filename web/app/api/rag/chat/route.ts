import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Get backend URL from environment or fallback to localhost
    const backendUrl = process.env.NEXT_PUBLIC_RAG_ENDPOINT || 'http://localhost:8000';
    
    // Try to forward to backend
    try {
      const response = await fetch(`${backendUrl}/rag/chat`, {
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
      console.log('Backend unavailable for RAG, providing fallback response:', backendError);
      
      // Fallback response when backend is not available
      return NextResponse.json({
        choices: [{
          message: {
            content: "I'm a travel content creation assistant. I can help you generate ideas, outlines, scripts, and more for your travel reels. However, my RAG capabilities are currently unavailable. What would you like to create today?"
          }
        }],
        citations: [],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0
        }
      });
    }
  } catch (error) {
    console.error('RAG API error:', error);
    
    return NextResponse.json({
      choices: [{
        message: {
          content: "I'm having trouble processing your request right now. Please try again."
        }
      }],
      citations: [],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0
      }
    });
  }
}