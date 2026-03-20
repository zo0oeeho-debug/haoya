/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 强制设置站点URL，确保sitemap使用正确域名
  assetPrefix: undefined,
  env: {
    NEXT_PUBLIC_SITE_URL: 'https://haoya.asia'
  }
};

export default nextConfig;

