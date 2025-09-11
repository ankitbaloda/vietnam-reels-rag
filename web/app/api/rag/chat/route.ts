import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Mock RAG response for now since backend is not available
    return NextResponse.json({
      choices: [{
        message: {
          content: "I'm a travel content creation assistant. I can help you generate ideas, outlines, scripts, and more for your travel reels. What would you like to create today?"
        }
      }],
      citations: [],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0
      }
    });
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