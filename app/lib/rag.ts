export type KnowledgeDocument = {
  id: string
  name: string
  mimeType: string
  extractedText: string
  chunks: string[]
  createdAt: string
}

export type RankedChunk = {
  documentId: string
  documentName: string
  chunkIndex: number
  content: string
  score: number
}

const TOKEN_PATTERN = /[a-z0-9]+/g

function tokenize(text: string) {
  return text.toLowerCase().match(TOKEN_PATTERN) ?? []
}

export function chunkText(text: string, chunkSize = 900, overlap = 150) {
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim()

  if (!normalizedText) {
    return []
  }

  const chunks: string[] = []
  let startIndex = 0

  while (startIndex < normalizedText.length) {
    let endIndex = Math.min(startIndex + chunkSize, normalizedText.length)

    if (endIndex < normalizedText.length) {
      const paragraphBreak = normalizedText.lastIndexOf('\n\n', endIndex)
      const sentenceBreak = Math.max(
        normalizedText.lastIndexOf('. ', endIndex),
        normalizedText.lastIndexOf('! ', endIndex),
        normalizedText.lastIndexOf('? ', endIndex),
        normalizedText.lastIndexOf('\n', endIndex)
      )

      if (paragraphBreak > startIndex + Math.floor(chunkSize * 0.6)) {
        endIndex = paragraphBreak
      } else if (sentenceBreak > startIndex + Math.floor(chunkSize * 0.5)) {
        endIndex = sentenceBreak + 1
      }
    }

    const chunk = normalizedText.slice(startIndex, endIndex).trim()

    if (chunk) {
      chunks.push(chunk)
    }

    if (endIndex >= normalizedText.length) {
      break
    }

    startIndex = Math.max(endIndex - overlap, startIndex + 1)
  }

  return chunks
}

export function rankChunks(query: string, documents: KnowledgeDocument[], limit = 4) {
  const queryTokens = Array.from(new Set(tokenize(query).filter((token) => token.length > 2)))
  const rankedChunks: RankedChunk[] = []

  for (const document of documents) {
    document.chunks.forEach((content, chunkIndex) => {
      const lowerContent = content.toLowerCase()
      let score = 0

      for (const token of queryTokens) {
        if (lowerContent.includes(token)) {
          score += 2
        }
      }

      const contentTokens = tokenize(content)
      for (const token of queryTokens) {
        score += contentTokens.filter((contentToken) => contentToken === token).length
      }

      if (query.trim() && lowerContent.includes(query.toLowerCase().trim())) {
        score += 5
      }

      if (score > 0) {
        rankedChunks.push({
          documentId: document.id,
          documentName: document.name,
          chunkIndex,
          content,
          score,
        })
      }
    })
  }

  const sortedChunks = rankedChunks.sort((left, right) => right.score - left.score)
  return sortedChunks.slice(0, limit)
}

export function buildRagContext(query: string, documents: KnowledgeDocument[], limit = 4) {
  const rankedChunks = rankChunks(query, documents, limit)

  if (rankedChunks.length === 0) {
    return ''
  }

  return rankedChunks
    .map((chunk, index) => {
      return [
        `Document ${index + 1}: ${chunk.documentName} (chunk ${chunk.chunkIndex + 1})`,
        chunk.content,
      ].join('\n')
    })
    .join('\n\n---\n\n')
}