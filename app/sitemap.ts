import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  // 强制使用自定义域名 haoya.asia，覆盖所有可能的自动检测
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
