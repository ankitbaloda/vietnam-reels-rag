import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Try to forward to backend
    const response = await fetch('http://server:8000/rag/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (response.ok && response.body) {
      // Forward the streaming response
      return new NextResponse(response.body, {
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      throw new Error(`Backend returned ${response.status}`);
    }
  } catch (error) {
    console.error('RAG stream API error:', error);
    
    // Return a fallback SSE response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const message = "RAG service unavailable. Please ensure the FastAPI server and vector database are running.";
        controller.enqueue(encoder.encode(`event: message\ndata: {"delta": "${message}"}\n\n`));
        controller.enqueue(encoder.encode(`event: done\ndata: {"finish_reason": "error"}\n\n`));
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