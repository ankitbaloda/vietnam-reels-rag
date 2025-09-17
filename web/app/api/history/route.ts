import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    
    // Get backend URL from environment or fallback to localhost
    const backendUrl = process.env.NEXT_PUBLIC_RAG_ENDPOINT || 'http://localhost:8000';
    
    // Try to forward to backend
    const response = await fetch(`${backendUrl}/history?${queryString}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://web:3000',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      throw new Error(`Backend returned ${response.status}`);
    }
  } catch (error) {
    console.error('History API error:', error);
    
    const searchParams = request.nextUrl.searchParams;
    
    // Return empty history as fallback
    return NextResponse.json({
      session_id: searchParams.get('session_id') || '',
      messages: []
    });
  }
}