'use client'

import { useState, useRef, useEffect } from 'react'
import ChatMessage from '@/app/components/ChatMessage'
import LoadingDots from '@/app/components/LoadingDots'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

type Theme = 'light' | 'dark' | 'gradient'

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [theme, setTheme] = useState<Theme>('gradient')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load chat history from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem('chatHistory')
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages)
        const messagesWithDates = parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
        setMessages(messagesWithDates)
      } catch (error) {
        console.error('Error loading chat history:', error)
      }
    }

    // Load theme from localStorage
    const savedTheme = localStorage.getItem('chatTheme') as Theme
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [])

  // Save chat history to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('chatHistory', JSON.stringify(messages))
    }
  }, [messages])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage.content }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to get response')
      }

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your internet connection or try again later.`,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
    localStorage.removeItem('chatHistory')
  }

  const toggleTheme = () => {
    const themes: Theme[] = ['gradient', 'light', 'dark']
    const currentIndex = themes.indexOf(theme)
    const nextTheme = themes[(currentIndex + 1) % themes.length]
    setTheme(nextTheme)
    localStorage.setItem('chatTheme', nextTheme)
  }

  const getThemeStyles = () => {
    switch (theme) {
      case 'light':
        return {
          main: 'bg-white',
          container: 'bg-white',
          message: 'bg-gray-50',
          input: 'bg-gray-50'
        }
      case 'dark':
        return {
          main: 'bg-gray-900',
          container: 'bg-gray-800',
          message: 'bg-gray-900/30',
          input: 'bg-gray-800/50'
        }
      case 'gradient':
      default:
        return {
          main: 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-gray-800',
          container: 'bg-white/80 dark:bg-gray-800/90 backdrop-blur-xl',
          message: 'bg-gradient-to-b from-transparent to-gray-50/30 dark:to-gray-900/30',
          input: 'bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm'
        }
    }
  }

  const themeStyles = getThemeStyles()

  return (
    <main className={`flex min-h-screen flex-col items-center justify-center p-2 sm:p-4 md:p-6 transition-colors duration-300 ${themeStyles.main}`}>
      <div className={`w-full max-w-5xl h-[100vh] sm:h-[95vh] md:h-[90vh] flex flex-col ${themeStyles.container} rounded-none sm:rounded-2xl shadow-2xl overflow-hidden border border-gray-200/50 dark:border-gray-700/50 transition-colors duration-300`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white p-4 sm:p-5 md:p-6 flex justify-between items-center shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <span className="text-2xl sm:text-3xl">🤖</span>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">AI Chatbot</h1>
              <p className="text-xs sm:text-sm text-blue-100 mt-0.5">Powered by Groq AI ⚡</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 sm:p-2.5 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 group"
              title="Change theme"
            >
              {theme === 'gradient' && (
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              )}
              {theme === 'light' && (
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
              {theme === 'dark' && (
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200 text-xs sm:text-sm font-medium hover:scale-105 active:scale-95"
              >
                <span className="hidden sm:inline">Clear Chat</span>
                <span className="sm:hidden">Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Messages Container */}
        <div className={`flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 transition-colors duration-300 ${themeStyles.message}`}>
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center px-4">
              <div className="text-center text-gray-500 dark:text-gray-400 max-w-md">
                <div className="text-5xl sm:text-6xl md:text-7xl mb-4 animate-bounce">💬</div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Start a Conversation
                </h2>
                <p className="text-xs sm:text-sm md:text-base">Send a message to begin chatting with AI</p>
                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                  <div className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-full text-xs">
                    💡 Ask anything
                  </div>
                  <div className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-full text-xs">
                    🚀 Fast responses
                  </div>
                  <div className="px-3 py-1.5 bg-pink-100 dark:bg-pink-900/30 rounded-full text-xs">
                    🎨 Markdown support
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isLoading && (
                <div className="flex items-start space-x-2 sm:space-x-3 animate-fade-in">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold flex-shrink-0 text-xs sm:text-sm">
                    AI
                  </div>
                  <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl rounded-tl-sm p-3 sm:p-4">
                    <LoadingDots />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className={`border-t border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-5 transition-colors duration-300 ${themeStyles.input}`}>
          <div className="flex space-x-2 sm:space-x-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="flex-1 resize-none rounded-xl sm:rounded-2xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent max-h-32 transition-all duration-200"
              rows={1}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white rounded-xl sm:rounded-2xl font-semibold hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center min-w-[60px] sm:min-w-[80px]"
            >
              {isLoading ? (
                <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <span className="hidden sm:inline">Send</span>
              )}
              {!isLoading && (
                <svg className="sm:hidden w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center hidden sm:block">
            Press Enter to send • Shift+Enter for new line
          </p>
        </div>
      </div>
    </main>
  )
}
