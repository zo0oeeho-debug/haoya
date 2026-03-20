import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  // 强制使用自定义域名 haoya.asia
  const baseUrl = 'https://haoya.asia'

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ]
}
