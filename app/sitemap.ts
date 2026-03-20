import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  // 如果你之后绑定了自定义域名，请替换这里
  const baseUrl = 'https://haoya.vercel.app'

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ]
}
