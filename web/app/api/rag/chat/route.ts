import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Try to forward to backend
    const response = await fetch('http://localhost:8000/rag/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      throw new Error(`Backend returned ${response.status}`);
    }
  } catch (error) {
    console.error('RAG API error:', error);
    
    // Return a fallback response
    return NextResponse.json({
      choices: [{
        message: {
          content: "RAG service is currently unavailable. Please ensure the FastAPI server is running and the vector database is accessible."
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