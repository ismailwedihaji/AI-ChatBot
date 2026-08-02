/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tesseract resolves its Node worker relative to its installed package.
  // Keeping it external prevents Next.js from rewriting that path into .next.
  experimental: {
    serverComponentsExternalPackages: ['tesseract.js'],
  },
}

module.exports = nextConfig
