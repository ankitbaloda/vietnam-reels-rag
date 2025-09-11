import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Mock chat response for now since backend is not available
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const message = "I'm a travel content creation assistant. I can help you generate ideas, outlines, scripts, and more for your travel reels. What would you like to create today?";
        controller.enqueue(encoder.encode(`event: message\ndata: {"delta": "${message}"}\n\n`));
        controller.enqueue(encoder.encode(`event: done\ndata: {"finish_reason": "stop"}\n\n`));
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
  } catch (error) {
    console.error('Chat stream API error:', error);
    
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const message = "I'm having trouble processing your request right now. Please try again.";
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