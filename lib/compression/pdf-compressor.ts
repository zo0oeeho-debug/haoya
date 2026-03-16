
import { PDFDocument } from "pdf-lib";
import type { PDFDocumentProxy } from "pdfjs-dist";

export type PdfCompressOptions = {
  /**
   * 目标图片质量（0~1）。越低体积越小、画质越差。
   */
  imageQuality?: number;
  /**
   * 目标最大宽度（像素）。嵌入图片会等比缩放到该宽度以内。
   */
  maxWidth?: number;
  onProgress?: (progress: number) => void;
};

// Helper to init worker
async function initPdfWorker() {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const mod = pdfjsLib as any;
  const pdfjs: any = mod.default || mod;

  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    // Try to use the version from the library, or fallback to a known stable version
    const version = pdfjs.version || "4.10.38";
    // Use unpkg with the specific version
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/legacy/build/pdf.worker.min.mjs`;
  }
  return pdfjs;
}

/**
 * 真正的 PDF 客户端压缩实现（面向“图片型 PDF”）：
 * - 使用 pdf.js 把每一页渲染到 canvas，再按照指定质量导出为 JPEG。
 * - 使用 pdf-lib 创建一个新的 PDF，将上述 JPEG 逐页嵌入重建。
 *
 * 重要取舍：
 * - 优点：对“扫描件/图片型 PDF”能显著缩小体积。
 * - 缺点：会丢失文本可选中/搜索能力，以及矢量图形的无损特性，本质上变成“按页截图的 PDF”。
 */
export async function compressPdf(
  file: File,
  opts: PdfCompressOptions = {}
): Promise<File> {
  const imageQuality = opts.imageQuality ?? 0.72;
  const maxWidth = opts.maxWidth ?? 1600;

  // 粗略进度：0-10% 为解析阶段，10-90% 为逐页渲染，90-100% 为重建导出
  opts.onProgress?.(5);

  let pdf: PDFDocumentProxy | null = null;
  let loadingTask: any = null;

  try {
    const pdfjs = await initPdfWorker();

    const arrayBuffer = await file.arrayBuffer();
    // 使用 cMapUrl 解决部分字体乱码/加载失败问题
    loadingTask = pdfjs.getDocument({ 
      data: arrayBuffer,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version || "4.10.38"}/cmaps/`,
      standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version || "4.10.38"}/standard_fonts/`,
      cMapPacked: true,
    });
    pdf = await loadingTask.promise;

    if (!pdf) throw new Error("PDF load failed");

    const pageCount: number = pdf.numPages;

    const newPdf = await PDFDocument.create();

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      // 1. 异步阻塞，防止 UI 卡死 (Optimized: yield main thread)
      await new Promise(resolve => setTimeout(resolve, 0));

      const logicalPageNumber = pageIndex + 1;
      
      try {
        const page = await pdf.getPage(logicalPageNumber);

        const baseViewport = page.getViewport({ scale: 1 });
        const { width: w, height: h } = baseViewport;
        const scale =
          maxWidth && w > maxWidth ? maxWidth / w : 1;
        const viewport = page.getViewport({ scale });

        // 在客户端创建 canvas 用于渲染
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("无法获取 2D 渲染上下文");
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // 填充白色背景，防止透明 PDF 渲染成黑色背景
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvasContext: context,
          viewport
        } as any).promise;
        
        // Page cleanup
        page.cleanup();

        // canvas -> JPEG Blob
        const jpegBlob: Blob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("canvas 导出 JPEG 失败"));
                return;
              }
              resolve(blob);
            },
            "image/jpeg",
            imageQuality
          );
        });
        
        // Explicitly clear canvas references
        canvas.width = 0;
        canvas.height = 0;

        const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
        const embeddedImage = await newPdf.embedJpg(jpegBytes);

        const { width, height } = embeddedImage;
        const newPage = newPdf.addPage([width, height]);
        newPage.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width,
          height
        });

      } catch (pageError) {
         console.error(`Page ${logicalPageNumber} compression failed:`, pageError);
         // Continue to next page instead of failing entire document? 
         // For now, let's allow partial failure if needed, or rethrow.
         // Rethrowing to alert user.
         throw pageError;
      }

      const progressBase = 10;
      const progressSpan = 80;
      const ratio = (pageIndex + 1) / pageCount;
      const current = progressBase + progressSpan * ratio;
      opts.onProgress?.(Math.round(current));
    }

    opts.onProgress?.(95);

    // 2. 内存优化：useObjectStreams: false 可以减少 save 时的内存峰值
    const compressedBytes = await newPdf.save({ useObjectStreams: false });

    opts.onProgress?.(100);

    // 兜底策略：如果压缩后体积反而变大，则直接返回原文件
    if (compressedBytes.byteLength >= file.size) {
        console.log("Compressed PDF is larger than original, returning original file.");
        return file;
    }

    // 文件名不变，只更新内容
    return new File([compressedBytes as BlobPart], file.name, {
      type: "application/pdf"
    });
  } catch (error) {
    console.error("PDF Compression Error:", error);
    throw error;
  } finally {
    // 3. 资源释放
    if (loadingTask && loadingTask.destroy) {
        try {
            loadingTask.destroy();
        } catch (e) {
            console.warn("LoadingTask destroy failed", e);
        }
    }
    if (pdf && (pdf as any).cleanup) {
        try {
            (pdf as any).cleanup();
        } catch (e) {
            console.warn("PDF cleanup failed", e);
        }
    }
  }
}

export async function analyzePdfSample(file: File): Promise<{ pageCount: number, sampleSize?: number }> {
  try {
    const pdfjs = await initPdfWorker();

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ 
      data: arrayBuffer,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version || "4.10.38"}/cmaps/`,
      standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version || "4.10.38"}/standard_fonts/`,
      cMapPacked: true,
    });
    
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;
    
    // Sample compression on the first page
    let sampleSize = 0;
    try {
        if (pageCount > 0) {
            const page = await pdf.getPage(1);
            const baseViewport = page.getViewport({ scale: 1 });
            const { width: w } = baseViewport;
            
            // Standard baseline: Quality 0.6, MaxWidth 1600
            const maxWidth = 1600;
            const scale = maxWidth && w > maxWidth ? maxWidth / w : 1;
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            if (context) {
                try {
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    context.fillStyle = "#ffffff";
                    context.fillRect(0, 0, canvas.width, canvas.height);
                    
                    await page.render({
                        canvasContext: context,
                        viewport
                    } as any).promise;

                    const blob = await new Promise<Blob | null>(resolve => 
                        canvas.toBlob(resolve, "image/jpeg", 0.6)
                    );
                    
                    if (blob) {
                        sampleSize = blob.size;
                    }
                } finally {
                    // Cleanup
                    canvas.width = 0;
                    canvas.height = 0;
                }
            }
            page.cleanup();
        }
    } catch (sampleErr) {
        console.warn("Sample compression failed:", sampleErr);
        // Continue without sample size
    }

    return { pageCount, sampleSize: sampleSize > 0 ? sampleSize : undefined };

  } catch (e) {
    console.error("Analyze PDF Error:", e);
    // Fallback
    try {
        const arrayBuffer = await file.arrayBuffer();
        const doc = await PDFDocument.load(arrayBuffer);
        return { pageCount: doc.getPageCount() };
    } catch (e2) {
        console.error("Analyze PDF Fallback Error:", e2);
        throw e;
    }
  }
}

export async function analyzePdf(file: File): Promise<{ pageCount: number }> {
    const res = await analyzePdfSample(file);
    return { pageCount: res.pageCount };
}

/**
 * Split PDF options
 */
export type SplitPdfOptions = {
    /** Target size in bytes for each part (e.g., 10MB) */
    targetSizeBytes?: number;
    /** Explicit number of parts (overrides targetSizeBytes if both provided, usually) */
    parts?: number;
    /** Callback for progress updates */
    onProgress?: (status: string, progress: number) => void;
};

/**
 * 将 PDF 文件按指定份数或目标大小自动拆分，并打包为 ZIP
 * @param file 源文件
 * @param options 拆分配置
 * @returns ZIP 文件
 */
export async function splitPdf(file: File, options: SplitPdfOptions): Promise<File> {
  const { targetSizeBytes, parts, onProgress } = options;
  
  if (onProgress) onProgress("正在分析文件...", 5);
  
  // 1. 获取基础数据
  const totalSize = file.size;
  const arrayBuffer = await file.arrayBuffer();
  
  // Use try-catch for loading the document to handle corrupt files
  let srcDoc;
  try {
      srcDoc = await PDFDocument.load(arrayBuffer);
  } catch (e) {
      console.error("Failed to load PDF for splitting:", e);
      throw new Error("文件加载失败，可能是文件损坏或格式不支持");
  }
  
  const totalPages = srcDoc.getPageCount();

  // 2. 执行拆分算法
  let pagesPerPart: number;
  let totalParts: number;

  if (parts && parts > 0) {
      // 显式指定份数
      totalParts = parts;
      pagesPerPart = Math.ceil(totalPages / totalParts);
  } else {
      // 自动计算 (默认 10MB)
      const targetSize = targetSizeBytes || 10 * 1024 * 1024;
      const avgPageSize = totalSize / totalPages;
      // 至少 1 页
      pagesPerPart = Math.max(1, Math.floor(targetSize / avgPageSize));
      totalParts = Math.ceil(totalPages / pagesPerPart);
  }
  
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const baseName = file.name.replace(/\.pdf$/i, "");
  
  // 3. 核心循环
  for (let i = 0; i < totalParts; i++) {
    // 异步阻塞，防止 UI 卡死
    await new Promise(resolve => setTimeout(resolve, 0));

    const startPage = i * pagesPerPart;
    if (startPage >= totalPages) break;
    
    // UI 状态更新
    if (onProgress) {
       onProgress(`正在生成第 ${i + 1}/${totalParts} 份...`, Math.round(((i) / totalParts) * 100));
    }

    const newDoc = await PDFDocument.create();
    
    // 确保最后一份包含剩余所有页
    const endPage = Math.min((i + 1) * pagesPerPart, totalPages);
    
    const pageIndices: number[] = [];
    for (let p = startPage; p < endPage; p++) {
      pageIndices.push(p);
    }
    
    const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
    copiedPages.forEach((page) => newDoc.addPage(page));
    
    // 保存并添加到 zip
    // Optimize: useObjectStreams: false reduces memory usage significantly for large files
    const pdfBytes = await newDoc.save({ useObjectStreams: false }); 
    const newFileName = `${baseName}_part${i + 1}.pdf`;
    zip.file(newFileName, pdfBytes);
  }

  if (onProgress) onProgress("正在打包...", 95);

  // 4. 导出方式
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const zipFile = new File([zipBlob], `${baseName}_split.zip`, { type: "application/zip" });
  
  if (onProgress) onProgress("完成", 100);

  return zipFile;
}
