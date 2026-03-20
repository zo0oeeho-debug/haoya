
const fs = require('fs')
const path = require('path')

const cacheDir = path.join(process.cwd(), '.next/cache/fetch-cache')

class CacheHandler {
  constructor(options) {
    this.options = options
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true })
    }
  }

  async get(key) {
    const filePath = path.join(cacheDir, key)
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8')
      return JSON.parse(data)
    }
    return null
  }

  async set(key, data, ctx) {
    const filePath = path.join(cacheDir, key)
    fs.writeFileSync(filePath, JSON.stringify({
      value: data,
      lastModified: Date.now(),
      tags: ctx.tags,
    }))
  }

  async revalidateTag(tag) {
    // Basic implementation for tag revalidation
    // In a real production environment (like Vercel), this is handled automatically
    // or requires a more complex store (Redis/KV).
    // For local/self-hosting, we might iterate files to find matching tags.
    console.log(`Revalidating tag: ${tag}`)
  }
}

module.exports = CacheHandler
