import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Try to forward to backend
    const response = await fetch('http://server:8000/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      throw new Error(`Backend returned ${response.status}`);
    }
  } catch (error) {
    console.error('Chat API error:', error);
    
    // Return a fallback response
    return NextResponse.json({
      choices: [{
        message: {
          content: "I'm sorry, the backend service is currently unavailable. Please ensure the FastAPI server is running on port 8000."
        }
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0
      }
    });
  }
}