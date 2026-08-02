import { NextRequest, NextResponse } from 'next/server'
import { recognize } from 'tesseract.js'

export const runtime = 'nodejs'

function isPdfFile(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function isImageFile(file: File) {
  return file.type.startsWith('image/')
}

function isTextFile(file: File) {
  const lowerName = file.name.toLowerCase()
  return (
    file.type.startsWith('text/') ||
    lowerName.endsWith('.txt') ||
    lowerName.endsWith('.md') ||
    lowerName.endsWith('.csv') ||
    lowerName.endsWith('.json')
  )
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const uploadedFile = formData.get('file')

    if (!(uploadedFile instanceof File)) {
      return NextResponse.json({ error: 'A file upload is required' }, { status: 400 })
    }

    const buffer = Buffer.from(await uploadedFile.arrayBuffer())
    let extractedText = ''

    if (isPdfFile(uploadedFile)) {
      return NextResponse.json(
        { error: 'PDF files are now parsed in the browser before upload' },
        { status: 400 }
      )
    } else if (isImageFile(uploadedFile)) {
      // Serverless deployments expose /tmp as the writable cache location.
      // Avoid writing eng.traineddata into the application directory.
      const ocrResult = await recognize(buffer, 'eng', { cachePath: '/tmp' })
      extractedText = ocrResult.data.text ?? ''
    } else if (isTextFile(uploadedFile)) {
      extractedText = buffer.toString('utf8')
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Use PDF, image, or text files.' },
        { status: 400 }
      )
    }

    const cleanedText = extractedText.replace(/\s+/g, ' ').trim()

    if (!cleanedText) {
      return NextResponse.json(
        { error: 'No readable text was found in that file' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      fileName: uploadedFile.name,
      mimeType: uploadedFile.type,
      text: cleanedText,
    })
  } catch (error) {
    console.error('Error extracting file contents:', error)

    return NextResponse.json(
      {
        error: 'Failed to extract text from the uploaded file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
