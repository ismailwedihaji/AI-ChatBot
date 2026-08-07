# 🤖 AI Chatbot - Next.js + Groq API

A modern, full-stack, multimodal AI chatbot built with **Next.js 14 (App Router)** and **Tailwind CSS**, powered by **Groq's lightning-fast AI API** using the **llama-3.1-8b-instant** model. The app also includes a lightweight **retrieval-augmented generation (RAG)** workflow for uploaded documents and images.

## 🚀 Live Demo

Try out the chatbot live at: [https://ai-chat-bot-eight-alpha.vercel.app/](https://ai-chat-bot-eight-alpha.vercel.app/)

## ✨ Features

- 💬 **Real-time chat interface** with user and AI messages
- 🎨 **Beautiful UI** with gradient backgrounds and smooth animations
- 📱 **Responsive design** that works on mobile and desktop
- 💾 **Persistent chat history** stored in localStorage
- 📚 **Lightweight RAG-style retrieval** for uploaded PDFs, text files, and OCR-extracted images
- 🖼️ **Multimodal support** with vision-ready image attachments
- ⚡ **Lightning-fast responses** powered by Groq's optimized inference
- 🌙 **Dark mode support** with system preference detection
- ⌨️ **Keyboard shortcuts** (Enter to send, Shift+Enter for new line)
- 🔄 **Auto-scroll** to latest messages
- 🎯 **Error handling** with user-friendly messages
- 📝 **Markdown support** for AI responses

## 🚀 Prerequisites

Before running this application, make sure you have:

1. **Node.js** (v18 or higher) installed
2. **A Groq API Key** (free tier available at [console.groq.com](https://console.groq.com))

### Getting a Groq API Key

1. Visit [https://console.groq.com](https://console.groq.com)
2. Sign up for a free account
3. Navigate to the API Keys section
4. Create a new API key
5. Copy the key (you'll need it for the `.env.local` file)

## 📦 Local Installation

1. **Clone the repository** (or navigate to the project directory):
   ```bash
   cd AI-ChatBot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create a `.env.local` file** in the root directory and add your Groq API key:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🌐 Deploy to Vercel (Free & Easy!)

### Quick Deploy (Recommended)

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/AI-ChatBot.git
   git push -u origin main
   ```

2. **Deploy on Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "Sign Up" and login with your GitHub account
   - Click "New Project"
   - Import your `AI-ChatBot` repository
   - Add Environment Variable:
     - Name: `GROQ_API_KEY`
     - Value: Your Groq API key
   - Click "Deploy"
   - Done! Your app will be live in ~2 minutes 🎉

### Or use Vercel CLI:
```bash
npm i -g vercel
vercel login
vercel --prod
```

Your chatbot will be live at: `https://your-project-name.vercel.app`

## 🏗️ Project Structure

```
AI-ChatBot/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts          # Backend API route for Groq AI
│   │   └── extract/
│   │       └── route.ts          # OCR and text extraction route
│   ├── components/
│   │   ├── ChatMessage.tsx       # Individual message component
│   │   └── LoadingDots.tsx       # Loading animation component
│   ├── globals.css               # Global styles with Tailwind
│   ├── lib/
│   │   └── rag.ts                # Chunking and retrieval helpers
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main chat UI page
├── public/                       # Static assets
├── .env.local                    # Environment variables (GROQ_API_KEY)
├── .gitignore
├── next.config.js                # Next.js configuration
├── package.json                  # Dependencies
├── postcss.config.js             # PostCSS configuration
├── tailwind.config.js            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript configuration
└── README.md                     # This file
```

## 🔧 How It Works

### Frontend (`app/page.tsx`)
- Built with React functional components and hooks
- Uses `useState` to manage chat messages and loading state
- Extracts text from uploaded PDFs in the browser and OCR/text from other files through `/api/extract`
- Builds a retrieval context from indexed documents with chunking and relevance ranking
- Sends POST requests to `/api/chat` with user messages and retrieved context
- Displays messages in a scrollable chat interface
- Stores chat history in localStorage for persistence
- Supports markdown rendering for AI responses

### Backend (`app/api/chat/route.ts`)
- Next.js API Route Handler
- Accepts POST requests with chat messages plus optional retrieved context
- Authenticates with Groq API using the API key from environment variables
- Forwards requests to Groq API at `https://api.groq.com/openai/v1/chat/completions`
- Uses the **llama-3.1-8b-instant** model for fast inference
- Model configuration: temperature 0.7, max tokens 1024
- Parses Groq response and returns: `{ "reply": "AI response" }`
- Includes comprehensive error handling

### Retrieval Layer (`app/lib/rag.ts`)
- Chunks extracted document text into overlapping passages
- Ranks chunks against the user query using token overlap
- Builds a compact context block that is injected into the chat prompt

### File Extraction (`app/api/extract/route.ts`)
- OCR for image uploads using Tesseract.js
- Plain text handling for `.txt`, `.md`, `.csv`, and `.json` files
- Returns cleaned text for indexing and retrieval

### Styling
- Tailwind CSS for modern, responsive design
- Custom gradient backgrounds (blue to purple)
- Smooth animations and transitions
- Dark mode support with system preference detection
- Custom scrollbar styling

## 🎯 Usage Example

1. Open the app at http://localhost:3000
3. Upload a PDF, image, or text file if you want document-grounded responses
4. Type a message like: **"Summarize this document"** or **"What does the screenshot say?"**
5. Press **Enter** or click **Send**
6. The AI will process your message and respond with markdown-formatted text
7. Chat history is automatically saved in your browser

## 🛠️ Available Scripts

- `npm run dev` - Start development server (http://localhost:3000)
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## 🐛 Troubleshooting

### "GROQ_API_KEY is not configured" error
- Make sure you've created a `.env.local` file in the root directory
- Add your Groq API key: `GROQ_API_KEY=your_key_here`
- Restart the development server after adding the key

### "Groq API error" messages
- Verify your API key is valid at [console.groq.com](https://console.groq.com)
- Check if you've exceeded your API rate limit (free tier has limits)
- Ensure you have an active internet connection

### Network/Connection errors
- Check your internet connection
- Verify Groq API status at [status.groq.com](https://status.groq.com) (if available)
- Check browser console for detailed error messages

### Port 3000 already in use
- Use a different port: `npm run dev -- -p 3001`

## 🎨 Customization

### Change the AI Model
Edit `app/api/chat/route.ts` and update the model name. Available Groq models include:
- `llama-3.1-8b-instant` (current - very fast)
- `llama-3.1-70b-versatile` (more powerful)
- `mixtral-8x7b-32768` (large context window)
- `gemma2-9b-it` (Google's Gemma model)

```typescript
body: JSON.stringify({
  model: 'llama-3.1-70b-versatile', // Change this to any Groq model
  messages: [
    {
      role: 'user',
      content: message
    }
  ],
  temperature: 0.7,
  max_tokens: 1024,
}),
```

### Adjust Response Parameters
- **temperature** (0.0-1.0): Lower = more focused, Higher = more creative
- **max_tokens**: Maximum response length (1024 = ~750 words)

### Modify Colors
Edit `tailwind.config.js` or update gradient classes in components.

### Add Streaming Responses
Set `stream: true` in the Groq API request and implement streaming logic to display text word-by-word as it's generated.

### Improve RAG
If you want stronger retrieval quality, you can replace the current keyword-based ranking with embeddings and a vector database, then feed the top matches into the same chat prompt.

## � Cost & Limits

Groq offers a **generous free tier** with:
- Fast inference speeds (tokens per second)
- Multiple model options
- Rate limits apply (check [console.groq.com](https://console.groq.com) for current limits)

## �📝 License

MIT License - feel free to use this project however you like!

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 🌟 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Powered by [Groq AI](https://groq.com/) - Lightning-fast LLM inference
- Markdown rendering by [react-markdown](https://github.com/remarkjs/react-markdown)

---

**Made with ❤️ using Next.js 14 and Groq AI**

---

**Enjoy chatting with your local AI! 🚀**
