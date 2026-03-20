import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  // 如果你之后绑定了自定义域名，请替换这里
  const baseUrl = 'https://haoya.vercel.app'

  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
