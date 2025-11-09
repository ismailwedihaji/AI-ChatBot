import React from 'react'
import ReactMarkdown from 'react-markdown'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

type ChatMessageProps = {
  message: Message
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${
          isUser
            ? 'bg-gradient-to-br from-blue-500 to-blue-600'
            : 'bg-gradient-to-br from-purple-500 to-pink-500'
        }`}
      >
        {isUser ? 'U' : 'AI'}
      </div>

      {/* Message Bubble */}
      <div className="flex flex-col max-w-[75%]">
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-tr-sm'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-tl-sm'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-headings:mt-3 prose-headings:mb-2">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>
        <span className={`text-xs text-gray-500 dark:text-gray-400 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}
