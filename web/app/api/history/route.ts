import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    
    // Try to forward to backend
    const response = await fetch(`http://server:8000/history?${queryString}`, {
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
    console.error('History API error:', error);
    
    // Return empty history as fallback
    return NextResponse.json({
      session_id: searchParams.get('session_id') || '',
      messages: []
    });
  }
}