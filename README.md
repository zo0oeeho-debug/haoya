# 好压 (LocalPress)

现代化的本地媒体压缩工具，支持图片（WebP/JPEG/PNG）和 PDF。所有处理均在浏览器端完成，无需上传文件。
- 图片：`browser-image-compression`
- 视频：`ffmpeg.wasm`（`@ffmpeg/ffmpeg`）
- PDF：使用 `pdf.js` 将页面渲染为图片，再用 `pdf-lib` 按可控质量/尺寸重建 PDF，尤其适合扫描件/图片型 PDF

## 运行前置
你本机当前环境未检测到 Node（`node` 不存在）。请先安装 Node.js 18+（推荐 20+）。

## 安装与启动（安装 Node 后）
在项目根目录执行：

```bash
npm install
npm run dev
```

## 说明
- 所有压缩逻辑在浏览器端执行，不上传到服务端。
- 目前已搭好 UI、拖拽上传、进度/体积对比，以及三种模式的调用入口。
- 你装好依赖后即可直接跑；PDF 压缩策略可按你的目标质量/速度继续完善。

