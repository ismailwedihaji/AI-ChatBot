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

    // Check if the latest message is asking about creator/identity
    const lastMessage = messages[messages.length - 1]
    const creatorQuestions = [
      /who\s+(are\s+you|created\s+you|made\s+(you|this)|developed\s+(you|this)|built\s+(you|this))/i,
      /what\s+(are\s+you|is\s+this)/i,
      /your\s+creator/i,
      /who\s+is\s+ismail/i,
      /tell\s+me\s+about\s+(yourself|you|ismail)/i,
      /about\s+ismail/i
    ]

    const isCreatorQuestion = creatorQuestions.some(pattern => 
      pattern.test(lastMessage.content)
    )

    if (isCreatorQuestion && lastMessage.role === 'user') {
      // Get professional info from environment variables
      const creatorName = process.env.CREATOR_NAME || 'the developer'
      const creatorAlias = process.env.CREATOR_ALIAS || ''
      const creatorTitle = process.env.CREATOR_TITLE || 'a developer'
      const creatorEducation = process.env.CREATOR_EDUCATION || ''
      const creatorBackground = process.env.CREATOR_BACKGROUND || ''
      const creatorSkills = process.env.CREATOR_SKILLS || ''
      const creatorInterests = process.env.CREATOR_INTERESTS || ''
      const creatorBio = process.env.CREATOR_BIO || ''
      
      // Get response templates from environment
      const aboutCreatorTemplate = process.env.CHATBOT_ABOUT_CREATOR_RESPONSE || ''
      const whoAreYouTemplate = process.env.CHATBOT_WHO_ARE_YOU_RESPONSE || ''
      const fallbackTemplate = process.env.CHATBOT_FALLBACK_MESSAGE || 'I\'m an AI chatbot. Ask me anything!'
      
      // Check if specifically asking about Ismail
      const isAboutIsmail = /who\s+is\s+ismail|tell\s+me\s+about\s+ismail|about\s+ismail/i.test(lastMessage.content)
      
      let customReply = ''
      
      if (isAboutIsmail && aboutCreatorTemplate) {
        // Use template and replace placeholders
        customReply = aboutCreatorTemplate
          .replace(/{NAME}/g, creatorName)
          .replace(/{ALIAS}/g, creatorAlias)
          .replace(/{TITLE}/g, creatorTitle)
          .replace(/{EDUCATION}/g, creatorEducation)
          .replace(/{BACKGROUND}/g, creatorBackground)
          .replace(/{SKILLS}/g, creatorSkills.split(',').map(s => `• ${s.trim()}`).join('\n'))
          .replace(/{INTERESTS}/g, creatorInterests.split(',').map(i => `• ${i.trim()}`).join('\n'))
          .replace(/{BIO}/g, creatorBio)
          .replace(/\|/g, '\n\n')
      } else if (whoAreYouTemplate) {
        // Use template and replace placeholders
        customReply = whoAreYouTemplate
          .replace(/{NAME}/g, creatorName)
          .replace(/{ALIAS}/g, creatorAlias)
          .replace(/{TITLE}/g, creatorTitle)
          .replace(/{EDUCATION}/g, creatorEducation)
          .replace(/\|/g, '\n')
      } else {
        // Fallback if no templates
        customReply = fallbackTemplate.replace(/{NAME}/g, creatorName)
      }

      return NextResponse.json({ reply: customReply })
    }

    // Get system and context messages from environment
    const creatorName = process.env.CREATOR_NAME || 'the developer'
    const creatorAlias = process.env.CREATOR_ALIAS || ''
    const systemMessageTemplate = process.env.CHATBOT_SYSTEM_MESSAGE || 'You are a helpful AI assistant.'
    const contextMessageTemplate = process.env.CHATBOT_CONTEXT_MESSAGE || ''

    // Add system message to provide context about the chatbot
    const systemMessage = {
      role: 'system',
      content: systemMessageTemplate
        .replace(/{NAME}/g, creatorName)
        .replace(/{ALIAS}/g, creatorAlias)
        .replace(/\|/g, '\n\n')
    }
    
    // Add an initial assistant message to reinforce the context
    const contextMessage = {
      role: 'assistant',
      content: contextMessageTemplate.replace(/{NAME}/g, creatorName)
    }

    // Combine system message, context reinforcement, and user messages
    const allMessages = [systemMessage, contextMessage, ...messages]

    // Send request to Groq API
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant', // Fast and good model
        messages: allMessages,
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
