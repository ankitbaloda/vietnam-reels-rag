import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const { filename } = params;
    
    // Security: Only allow .md files and prevent directory traversal
    if (!filename.endsWith('.md') || filename.includes('..') || filename.includes('/')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }
    
    // Read the prompt file from the prompts directory
    // In Docker, the prompts directory is mounted to /app/prompts
    const promptsDir = '/app/prompts';
    const filePath = join(promptsDir, filename);
    
    console.log('Attempting to read prompt file:', filePath);
    
    const content = await readFile(filePath, 'utf-8');
    
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/markdown',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error reading prompt file:', error);
    return NextResponse.json(
      { error: 'Prompt file not found' },
      { status: 404 }
    );
  }
}