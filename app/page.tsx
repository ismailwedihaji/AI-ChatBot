'use client'

import { useState, useRef, useEffect } from 'react'
import ChatMessage from '@/app/components/ChatMessage'
import LoadingDots from '@/app/components/LoadingDots'
import { buildRagContext, chunkText, type KnowledgeDocument } from '@/app/lib/rag'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  attachments?: ImageAttachment[]
}

type Theme = 'light' | 'dark' | 'gradient'

type ImageAttachment = {
  id: string
  name: string
  dataUrl: string
}

const CHAT_HISTORY_STORAGE_KEY = 'chatHistory'
const CHAT_THEME_STORAGE_KEY = 'chatTheme'
const CHAT_KNOWLEDGE_STORAGE_KEY = 'chatKnowledgeBase'
const MAX_VISION_IMAGES = 3
const MAX_VISION_IMAGE_BYTES = 2_500_000
const MAX_VISION_PAYLOAD_CHARACTERS = 3_800_000

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read the selected image'))
    reader.readAsDataURL(blob)
  })
}

async function prepareImageAttachment(file: File, id: string): Promise<ImageAttachment> {
  const canUseOriginal =
    file.size <= MAX_VISION_IMAGE_BYTES &&
    ['image/jpeg', 'image/png'].includes(file.type)

  if (canUseOriginal) {
    return { id, name: file.name, dataUrl: await readBlobAsDataUrl(file) }
  }

  const bitmap = await createImageBitmap(file)
  const maxDimension = 1800
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')

  if (!context) {
    bitmap.close()
    throw new Error(`Could not prepare ${file.name} for vision`)
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  let quality = 0.88
  let compressedBlob: Blob | null = null

  while (quality >= 0.5) {
    compressedBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    )

    if (compressedBlob && compressedBlob.size <= MAX_VISION_IMAGE_BYTES) {
      break
    }

    quality -= 0.1
  }

  if (!compressedBlob || compressedBlob.size > MAX_VISION_IMAGE_BYTES) {
    throw new Error(`${file.name} is too large to send to the vision model`)
  }

  return { id, name: file.name, dataUrl: await readBlobAsDataUrl(compressedBlob) }
}

async function extractPdfText(file: File) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

  const pdfData = new Uint8Array(await file.arrayBuffer())
  const loadingTask = pdfjsLib.getDocument({ data: pdfData })
  const pdf = await loadingTask.promise
  const extractedPages: string[] = []

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .trim()

    if (pageText) {
      extractedPages.push(pageText)
    }

    page.cleanup()
  }

  loadingTask.destroy()
  return extractedPages.join('\n\n')
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [theme, setTheme] = useState<Theme>('gradient')
  const [knowledgeDocuments, setKnowledgeDocuments] = useState<KnowledgeDocument[]>([])
  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([])
  const [isIndexingDocuments, setIsIndexingDocuments] = useState(false)
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const [ragNotice, setRagNotice] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragDepthRef = useRef(0)

  // Load chat history from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY)
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
    const savedTheme = localStorage.getItem(CHAT_THEME_STORAGE_KEY) as Theme
    if (savedTheme) {
      setTheme(savedTheme)
    }

    const savedKnowledgeBase = localStorage.getItem(CHAT_KNOWLEDGE_STORAGE_KEY)
    if (savedKnowledgeBase) {
      try {
        const parsedKnowledgeBase = JSON.parse(savedKnowledgeBase)
        if (Array.isArray(parsedKnowledgeBase)) {
          // Images are message attachments, not persistent text-only documents.
          setKnowledgeDocuments(
            parsedKnowledgeBase.filter(
              (document) => !document?.mimeType?.startsWith('image/')
            )
          )
        }
      } catch (error) {
        console.error('Error loading knowledge base:', error)
      }
    }
  }, [])

  // Save chat history to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      // Image data URLs are intentionally not persisted because localStorage is small.
      const messagesWithoutImages = messages.map(({ attachments, ...message }) => message)
      localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(messagesWithoutImages))
    }
  }, [messages])

  useEffect(() => {
    if (knowledgeDocuments.length > 0) {
      localStorage.setItem(CHAT_KNOWLEDGE_STORAGE_KEY, JSON.stringify(knowledgeDocuments))
    } else {
      localStorage.removeItem(CHAT_KNOWLEDGE_STORAGE_KEY)
    }
  }, [knowledgeDocuments])

  // Auto-resize textarea based on content
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }

  // Auto-resize when input changes
  useEffect(() => {
    adjustTextareaHeight()
  }, [input])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    
    // Small delay to ensure DOM has updated
    const timeoutId = setTimeout(scrollToBottom, 100)
    return () => clearTimeout(timeoutId)
  }, [messages, isLoading])

  const sendMessage = async () => {
    if ((!input.trim() && pendingImages.length === 0) || isLoading || isIndexingDocuments) return

    const messageText = input.trim() || 'What is in this image?'
    const messageImages = [...pendingImages]

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
      attachments: messageImages,
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    // Reset textarea height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    setIsLoading(true)

    try {
      const currentMessages = [...messages, userMessage]
      const ragContext = buildRagContext(messageText, knowledgeDocuments, 4)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          messages: currentMessages.map((message) => ({
            role: message.role,
            content: message.content,
            ...(message.id === userMessage.id && messageImages.length > 0
              ? { images: messageImages.map((image) => image.dataUrl) }
              : {}),
          })),
          context: ragContext,
        }),
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
      setPendingImages([])
      const sentImageIds = new Set(messageImages.map((image) => image.id))
      setKnowledgeDocuments((currentDocuments) =>
        currentDocuments.filter((document) => !sentImageIds.has(document.id))
      )
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
    localStorage.removeItem(CHAT_HISTORY_STORAGE_KEY)
  }

  const toggleTheme = () => {
    const themes: Theme[] = ['gradient', 'light', 'dark']
    const currentIndex = themes.indexOf(theme)
    const nextTheme = themes[(currentIndex + 1) % themes.length]
    setTheme(nextTheme)
    localStorage.setItem(CHAT_THEME_STORAGE_KEY, nextTheme)
  }

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  const removeKnowledgeDocument = (documentId: string) => {
    setKnowledgeDocuments((currentDocuments) =>
      currentDocuments.filter((document) => document.id !== documentId)
    )
    setPendingImages((currentImages) =>
      currentImages.filter((image) => image.id !== documentId)
    )
  }

  const clearKnowledgeBase = () => {
    setKnowledgeDocuments([])
    setPendingImages([])
    setRagNotice('Knowledge base cleared')
  }

  const indexFiles = async (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) {
      return
    }

    setIsIndexingDocuments(true)
    setRagNotice(null)

    try {
      const indexedDocuments: KnowledgeDocument[] = []
      const indexedImages: ImageAttachment[] = []
      const selectedImageCount = selectedFiles.filter((file) => file.type.startsWith('image/')).length

      if (pendingImages.length + selectedImageCount > MAX_VISION_IMAGES) {
        throw new Error(`You can send up to ${MAX_VISION_IMAGES} images in one message`)
      }

      for (const file of selectedFiles) {
        const documentId = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${file.name}`
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        const isImage = file.type.startsWith('image/')
        let extractedText = ''

        if (isPdf) {
          extractedText = await extractPdfText(file)
        } else if (isImage) {
          indexedImages.push(await prepareImageAttachment(file, documentId))

          // OCR keeps screenshots searchable later, but vision attachment should
          // still work when an image contains little or no readable text.
          try {
            extractedText = await fetch('/api/extract', {
              method: 'POST',
              body: (() => {
                const formData = new FormData()
                formData.append('file', file)
                return formData
              })(),
            }).then(async (response) => {
              const data = await response.json()
              if (!response.ok) {
                throw new Error(data.error || `Failed to process ${file.name}`)
              }
              return data.text as string
            })
          } catch (error) {
            console.warn(`OCR was unavailable for ${file.name}; sending it to vision directly`, error)
          }
        } else {
          extractedText = await fetch('/api/extract', {
            method: 'POST',
            body: (() => {
              const formData = new FormData()
              formData.append('file', file)
              return formData
            })(),
          }).then(async (response) => {
            const data = await response.json()
            if (!response.ok) {
              throw new Error(data.error || `Failed to process ${file.name}`)
            }
            return data.text as string
          })
        }

        const chunks = chunkText(extractedText)

        if (chunks.length === 0 && !isImage) {
          throw new Error(`No usable text was found in ${file.name}`)
        }

        indexedDocuments.push({
          id: documentId,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          extractedText,
          chunks,
          createdAt: new Date().toISOString(),
        })
      }

      const nextPendingImages = [...pendingImages, ...indexedImages]
      const visionPayloadCharacters = nextPendingImages.reduce(
        (total, image) => total + image.dataUrl.length,
        0
      )

      if (visionPayloadCharacters > MAX_VISION_PAYLOAD_CHARACTERS) {
        throw new Error('The combined images are too large. Try fewer or smaller images.')
      }

      setKnowledgeDocuments((currentDocuments) => [...currentDocuments, ...indexedDocuments])
      setPendingImages(nextPendingImages)
      setRagNotice(
        indexedImages.length > 0
          ? `Attached ${indexedImages.length} image${indexedImages.length === 1 ? '' : 's'} for vision`
          : `Indexed ${indexedDocuments.length} file${indexedDocuments.length === 1 ? '' : 's'} for retrieval`
      )
    } catch (error) {
      console.error('Error indexing files:', error)
      setRagNotice(error instanceof Error ? error.message : 'Failed to index uploaded files')
    } finally {
      setIsIndexingDocuments(false)
    }
  }

  const handleFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? [])
    await indexFiles(selectedFiles)
    event.target.value = ''
  }

  const hasDraggedFiles = (event: React.DragEvent<HTMLElement>) =>
    Array.from(event.dataTransfer.types).includes('Files')

  const handleDragEnter = (event: React.DragEvent<HTMLElement>) => {
    if (!hasDraggedFiles(event)) return

    event.preventDefault()
    dragDepthRef.current += 1
    setIsDraggingFiles(true)
  }

  const handleDragOver = (event: React.DragEvent<HTMLElement>) => {
    if (!hasDraggedFiles(event)) return

    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave = (event: React.DragEvent<HTMLElement>) => {
    if (!hasDraggedFiles(event)) return

    event.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)

    if (dragDepthRef.current === 0) {
      setIsDraggingFiles(false)
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLElement>) => {
    if (!hasDraggedFiles(event)) return

    event.preventDefault()
    dragDepthRef.current = 0
    setIsDraggingFiles(false)

    if (!isIndexingDocuments) {
      void indexFiles(Array.from(event.dataTransfer.files))
    }
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
    <main
      className={`relative flex h-screen flex-col items-center justify-start sm:justify-center p-0 sm:p-4 md:p-6 transition-colors duration-300 ${themeStyles.main}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDraggingFiles && (
        <div className="pointer-events-none absolute inset-2 sm:inset-5 z-50 flex items-center justify-center rounded-3xl border-2 border-dashed border-purple-500 bg-purple-500/15 backdrop-blur-sm">
          <div className="rounded-2xl bg-white/95 dark:bg-gray-900/95 px-7 py-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white shadow-lg">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16V4m0 0L7 9m5-5 5 5M5 20h14" />
              </svg>
            </div>
            <p className="font-semibold text-gray-900 dark:text-gray-100">Drop files to add them</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">PDFs, images, and text files</p>
          </div>
        </div>
      )}
      <div className={`w-full max-w-5xl h-full sm:h-[95vh] md:h-[90vh] flex flex-col ${themeStyles.container} rounded-none sm:rounded-2xl shadow-none sm:shadow-2xl overflow-hidden border-0 sm:border border-gray-200/50 dark:border-gray-700/50 transition-colors duration-300`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white p-3 sm:p-5 md:p-6 flex justify-between items-center shadow-lg flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-12 sm:h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <span className="text-xl sm:text-3xl">🤖</span>
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl md:text-3xl font-bold">AI Chatbot (Hajawi_sheksawi)</h1>
              <p className="text-[10px] sm:text-sm text-blue-100 mt-0.5">Powered by Groq AI ⚡</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-1.5 sm:p-2.5 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 group"
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
                className="px-2 py-1.5 sm:px-4 sm:py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200 text-[10px] sm:text-sm font-medium hover:scale-105 active:scale-95"
              >
                <span className="hidden sm:inline">Clear Chat</span>
                <span className="sm:hidden">Clear</span>
              </button>
            )}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv,.json,image/*,application/pdf,text/*"
          multiple
          className="hidden"
          onChange={handleFileSelection}
        />

        {/* Messages Container */}
        <div className={`flex-1 overflow-y-auto p-2 sm:p-4 md:p-6 space-y-2 sm:space-y-4 transition-colors duration-300 ${themeStyles.message}`}>
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center px-4">
              <div className="text-center text-gray-500 dark:text-gray-400 max-w-md">
                <div className="text-4xl sm:text-6xl md:text-7xl mb-3 sm:mb-4 animate-bounce">💬</div>
                <h2 className="text-lg sm:text-2xl md:text-3xl font-semibold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Start a Conversation
                </h2>
                <p className="text-xs sm:text-sm md:text-base mb-4">Send a message to begin chatting with AI</p>
                <div className="mt-4 sm:mt-6 flex flex-wrap gap-2 justify-center">
                  <div className="px-2 py-1 sm:px-3 sm:py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-full text-[10px] sm:text-xs">
                    💡 Ask anything
                  </div>
                  <div className="px-2 py-1 sm:px-3 sm:py-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-full text-[10px] sm:text-xs">
                    🚀 Fast responses
                  </div>
                  <div className="px-2 py-1 sm:px-3 sm:py-1.5 bg-pink-100 dark:bg-pink-900/30 rounded-full text-[10px] sm:text-xs">
                    🎨 Markdown support
                  </div>
                </div>
                <p className="mt-4 sm:mt-6 text-[10px] sm:text-xs text-gray-600 dark:text-gray-300">
                  This chatbot created by <span className="font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">Ismail Mohammed</span> (<span className="font-bold text-transparent bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text">Wedihaji</span>)
                </p>
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
        <div className={`border-t border-gray-200 dark:border-gray-700 p-2 sm:p-4 md:p-5 transition-colors duration-300 flex-shrink-0 ${themeStyles.input}`}>
          <div className={`overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition-all duration-200 dark:bg-gray-700 ${isDraggingFiles ? 'border-purple-500 ring-4 ring-purple-500/15' : 'border-gray-300 focus-within:border-purple-500 focus-within:ring-4 focus-within:ring-purple-500/10 dark:border-gray-600'}`}>
            {knowledgeDocuments.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto border-b border-gray-200 px-3 py-2 dark:border-gray-600">
                <div className="flex min-w-0 flex-1 gap-2">
                  {knowledgeDocuments.map((document) => (
                    <div
                      key={document.id}
                      className="flex max-w-[220px] flex-none items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                    >
                      {pendingImages.find((image) => image.id === document.id) ? (
                        <img
                          src={pendingImages.find((image) => image.id === document.id)?.dataUrl}
                          alt=""
                          className="h-7 w-7 flex-none rounded-md object-cover"
                        />
                      ) : (
                        <svg className="h-4 w-4 flex-none text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828L18 9.828a4 4 0 10-5.657-5.657L5.757 10.757a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      )}
                      <span className="truncate">{document.name}</span>
                      <button
                        type="button"
                        onClick={() => removeKnowledgeDocument(document.id)}
                        className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-200 hover:text-red-500 dark:hover:bg-gray-600"
                        aria-label={`Remove ${document.name}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={clearKnowledgeBase}
                  className="flex-none text-[10px] font-medium text-gray-500 hover:text-red-500 dark:text-gray-400 sm:text-xs"
                >
                  Clear all
                </button>
              </div>
            )}

            <div className="flex items-end gap-1.5 p-2 sm:gap-2 sm:p-2.5">
              <button
                type="button"
                onClick={openFilePicker}
                disabled={isIndexingDocuments}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-gray-300 text-gray-700 transition-all hover:bg-gray-100 active:scale-95 disabled:cursor-wait disabled:opacity-60 dark:border-gray-500 dark:text-gray-100 dark:hover:bg-gray-600 sm:h-10 sm:w-10"
                title="Add photos and files"
                aria-label="Add photos and files"
              >
                {isIndexingDocuments ? (
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M12 3a9 9 0 00-9 9h3a6 6 0 016-6V3z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
                  </svg>
                )}
              </button>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  adjustTextareaHeight()
                }}
                onKeyDown={handleKeyDown}
                placeholder="Message AI Chatbot"
                className="min-h-[40px] max-h-[200px] flex-1 resize-none overflow-y-auto bg-transparent px-1 py-2 text-sm leading-6 text-gray-900 placeholder-gray-500 focus:outline-none disabled:opacity-60 dark:text-gray-100 sm:text-base"
                rows={1}
                disabled={isLoading}
              />

              <button
                type="button"
                onClick={sendMessage}
                disabled={(!input.trim() && pendingImages.length === 0) || isLoading || isIndexingDocuments}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white shadow-sm transition-all hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300 disabled:text-gray-500 disabled:shadow-none dark:disabled:from-gray-600 dark:disabled:to-gray-600 dark:disabled:text-gray-400 sm:h-10 sm:w-10"
                aria-label="Send message"
              >
                {isLoading ? (
                  <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M12 19V5m0 0-5 5m5-5 5 5" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div className="mt-1.5 flex min-h-[16px] items-center justify-center px-2 text-center text-[10px] sm:text-xs">
            {ragNotice ? (
              <p className="font-medium text-purple-700 dark:text-purple-300">{ragNotice}</p>
            ) : (
              <p className="hidden text-gray-500 dark:text-gray-400 sm:block">Use + or drag files here • Enter to send • Shift+Enter for new line</p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
