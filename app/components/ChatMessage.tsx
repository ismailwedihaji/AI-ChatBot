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
    <div className={`flex items-start space-x-2 ${isUser ? 'flex-row-reverse space-x-reverse' : ''} animate-fade-in`}>
      {/* Avatar */}
      <div
        className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white text-[10px] sm:text-sm font-bold flex-shrink-0 shadow-md ${
          isUser
            ? 'bg-gradient-to-br from-blue-500 to-blue-600'
            : 'bg-gradient-to-br from-purple-500 to-pink-500'
        }`}
      >
        {isUser ? 'U' : 'AI'}
      </div>

      {/* Message Bubble */}
      <div className="flex flex-col max-w-[85%] sm:max-w-[80%] md:max-w-[75%]">
        <div
          className={`rounded-xl sm:rounded-2xl px-2.5 py-2 sm:px-4 sm:py-3 shadow-md transition-all duration-200 hover:shadow-lg ${
            isUser
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-tr-sm'
              : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-tl-sm border border-gray-200 dark:border-gray-600'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words text-[13px] sm:text-base leading-relaxed">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-p:text-[13px] sm:prose-p:text-base prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-li:text-[13px] sm:prose-li:text-base prose-headings:mt-2 prose-headings:mb-1 prose-headings:text-sm sm:prose-headings:text-base prose-code:text-[11px] sm:prose-code:text-sm">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>
        <span className={`text-[9px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}
