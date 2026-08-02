import { NextRequest, NextResponse } from 'next/server'

const MAX_VISION_IMAGES = 3
const MAX_VISION_PAYLOAD_CHARACTERS = 3_800_000
const IMAGE_DATA_URL_PATTERN = /^data:image\/(jpeg|png);base64,/i

export async function POST(request: NextRequest) {
  try {
    const { messages, context } = await request.json()

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

      if (msg.images !== undefined) {
        if (
          !Array.isArray(msg.images) ||
          msg.images.length > MAX_VISION_IMAGES ||
          !msg.images.every((image: unknown) =>
            typeof image === 'string' && IMAGE_DATA_URL_PATTERN.test(image)
          )
        ) {
          return NextResponse.json(
            { error: `Images must be JPEG or PNG data URLs, with at most ${MAX_VISION_IMAGES} images` },
            { status: 400 }
          )
        }
      }
    }

    const visionPayloadCharacters = messages.reduce(
      (total, message) => total + (Array.isArray(message.images)
        ? message.images.reduce((imageTotal: number, image: string) => imageTotal + image.length, 0)
        : 0),
      0
    )

    if (visionPayloadCharacters > MAX_VISION_PAYLOAD_CHARACTERS) {
      return NextResponse.json(
        { error: 'The attached images are too large. Try fewer or smaller images.' },
        { status: 413 }
      )
    }

    if (context && typeof context !== 'string') {
      return NextResponse.json(
        { error: 'Context must be a string when provided' },
        { status: 400 }
      )
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

    if (isCreatorQuestion && lastMessage.role === 'user' && !lastMessage.images?.length) {
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
    const ragContext = typeof context === 'string' ? context.trim() : ''

    // Add system message to provide context about the chatbot
    const systemMessage = {
      role: 'system',
      content: systemMessageTemplate
        .replace(/{NAME}/g, creatorName)
        .replace(/{ALIAS}/g, creatorAlias)
        .replace(/\|/g, '\n\n')
    }

    const ragContextMessage = ragContext
      ? {
          role: 'system',
          content: `Use the retrieved document context below to answer the user's question. If the answer is not supported by the context, say that you do not have enough information.\n\nRetrieved document context:\n${ragContext}`,
        }
      : null
    
    // Add an initial assistant message to reinforce the context
    const contextMessage = contextMessageTemplate
      ? {
          role: 'assistant',
          content: contextMessageTemplate.replace(/{NAME}/g, creatorName),
        }
      : null

    const hasVisionImages = messages.some(
      (message) => Array.isArray(message.images) && message.images.length > 0
    )
    const conversationMessages = messages.map((message) => {
      const images = Array.isArray(message.images) ? message.images : []

      if (images.length === 0) {
        return { role: message.role, content: message.content }
      }

      return {
        role: message.role,
        content: [
          { type: 'text', text: message.content },
          ...images.map((image: string) => ({
            type: 'image_url',
            image_url: { url: image },
          })),
        ],
      }
    })

    // Combine system message, context reinforcement, and user messages
    const allMessages = [
      systemMessage,
      ...(ragContextMessage ? [ragContextMessage] : []),
      ...(contextMessage ? [contextMessage] : []),
      ...conversationMessages,
    ]

    // Send request to Groq API
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: hasVisionImages ? 'qwen/qwen3.6-27b' : 'llama-3.1-8b-instant',
        messages: allMessages,
        temperature: 0.7,
        max_completion_tokens: 1024,
        ...(hasVisionImages ? { reasoning_effort: 'none' } : {}),
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
