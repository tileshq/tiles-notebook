import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages, tools } = body;

    // Extract system messages from the messages array
    const systemMessages = messages.filter((msg: any) => msg.role === 'system');
    const nonSystemMessages = messages.filter((msg: any) => msg.role !== 'system');
    
    // Combine all system message content into a single system prompt
    const systemPrompt = systemMessages.length > 0 
      ? systemMessages.map((msg: any) => msg.content).join('\n\n')
      : undefined;

    // TODO: Replace with your actual Claude API key and endpoint
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 4096,
        messages: nonSystemMessages.map((msg: any) => ({
          role: msg.role,
          content: msg.content
        })),
        system: systemPrompt,
        tools: tools
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in Claude API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 