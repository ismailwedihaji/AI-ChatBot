import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required and must be non-empty' },
        { status: 400 }
      )
    }

    // Validate message structure
    for (const msg of messages) {
      if (!msg.role || !msg.content || typeof msg.content !== 'string' || !['user', 'assistant'].includes(msg.role)) {
        return NextResponse.json(
          { error: 'Invalid message structure. Each message must have role ("user" or "assistant") and content (string)' },
          { status: 400 }
        )
      }
    }

    const apiKey = process.env.GROQ_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY is not configured' },
        { status: 500 }
      )
    }

    // Send request to Groq API
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant', // Fast and good model
        messages: messages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    })

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text()
      console.error('Groq API error:', errorText)
      return NextResponse.json(
        { 
          error: `Groq API error: ${groqResponse.status} ${groqResponse.statusText}`,
          details: errorText
        },
        { status: 500 }
      )
    }

    const data = await groqResponse.json()

    // Extract the generated response from Groq
    const reply = data.choices?.[0]?.message?.content || 'No response generated'

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('Error in chat API:', error)

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
