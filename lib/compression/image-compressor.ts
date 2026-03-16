export type ImageCompressOptions = {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  initialQuality?: number;
  fileType?: string;
  onProgress?: (progress: number) => void;
};

export async function compressImage(
  file: File,
  opts: ImageCompressOptions = {}
): Promise<File> {
  // SVG 特殊处理：使用 SVGO 压缩
  if (file.type === "image/svg+xml") {
    try {
      let optimize;
      try {
          // Dynamic import for browser
          // @ts-ignore
          const svgo = await import("svgo/browser");
          const mod = svgo as any;
          optimize = mod.optimize || (mod.default && mod.default.optimize);
      } catch (e) {
          console.warn("[SVG Compress] SVGO browser import failed:", e);
      }

      if (!optimize) {
          throw new Error("SVGO optimize not available");
      }

      const svgText = await file.text();
      opts.onProgress?.(20);
      
      const result = optimize(svgText, {
        multipass: true, // 多次传递优化
        floatPrecision: 2, // 降低浮点数精度，通常2位小数足够
        plugins: [
          {
            name: "preset-default",
            params: {
              overrides: {
                // 确保移除 viewBox 是关闭的，否则可能导致缩放问题
                removeViewBox: false,
                // 移除未使用的 ID
                cleanupIds: true,
                // 移除隐藏元素
                removeHiddenElems: true,
                // 移除空文本
                removeEmptyText: true,
                // 转换形状为路径（通常更小）
                convertShapeToPath: true,
              },
            },
          },
          // 移除宽高属性，强制使用 viewBox（响应式更好）
          "removeDimensions",
          // 移除 XML 声明
          "removeXMLProcInst",
          // 移除注释
          "removeComments",
          // 移除元数据
          "removeMetadata",
          // 移除标题
          "removeTitle",
          // 移除描述
          "removeDesc",
          // 移除多余的命名空间
          "removeUselessDefs",
          // 移除编辑器数据
          "removeEditorsNSData",
          // 移除空属性
          "removeEmptyAttrs",
          // 移除隐藏元素
          "removeHiddenElems",
          // 移除空文本
          "removeEmptyText",
          // 移除空容器
          "removeEmptyContainers",
          // 移除多余的空格
          "cleanupListOfValues",
          // 压缩路径数据
          "convertPathData",
          // 压缩变换
          "convertTransform",
          // 移除未使用的命名空间
          "removeUnusedNS",
          // 排序属性（gzip 压缩更友好）
          "sortAttrs",
        ],
      });
      
      opts.onProgress?.(90);
      
      if ("data" in result) {
        opts.onProgress?.(100);
        return new File([result.data], file.name, { type: "image/svg+xml" });
      } else {
        console.warn("[SVG Compress] No data in result:", result);
      }
    } catch (e) {
      console.error("[SVG Compress] Failed:", e);
      return file;
    }
  }

  // 确定目标格式：如果没有显式指定，则保持原文件格式
  const targetFileType = opts.fileType || file.type;

  // 检查 Worker 是否支持该目标格式 (目前 Worker 只支持 AVIF 和 WebP)
  const workerSupports = targetFileType === "image/avif" || targetFileType === "image/webp";

  // 工业级/无损模式 (>0.85) 使用高级 Worker 压缩
  // 前提：目标格式必须是 Worker 支持的格式，且非 SVG
  if ((opts.initialQuality ?? 0.8) > 0.85 && file.type !== "image/svg+xml" && workerSupports) {
    try {
      return await compressWithWorker(file, opts);
    } catch (e) {
      console.warn("Advanced compression failed, falling back to standard:", e);
      // Fallback proceeds below
    }
  }

  const imageCompression = (await import("browser-image-compression")).default;

  const compressed = await imageCompression(file, {
    maxSizeMB: opts.maxSizeMB ?? 1,
    maxWidthOrHeight: opts.maxWidthOrHeight ?? 1920,
    useWebWorker: opts.useWebWorker ?? true,
    initialQuality: opts.initialQuality ?? 0.8,
    fileType: targetFileType,
    onProgress: (p: number) => opts.onProgress?.(p)
  });

  // browser-image-compression 返回的是 File/Blob（通常是 File）
  let resultFile: File;
  if (compressed instanceof File) {
      resultFile = compressed;
  } else {
      const blob = compressed as Blob;
      resultFile = new File([blob], file.name, { type: blob.type || file.type });
  }

  // 兜底策略：如果压缩后体积反而变大（常见于已经高度压缩的 JPEG 再转 PNG，或参数设置不当），则返回原文件
  // 但要注意：如果用户明确要求转换格式（例如 JPEG -> AVIF），即使体积变大也应该保留（虽然 AVIF 通常不会变大）
  // 这里我们只针对同格式或无明确格式转换意图的情况进行兜底
  if (resultFile.size > file.size && resultFile.type === file.type) {
      console.log(`Compression result larger than original (${resultFile.size} > ${file.size}), returning original.`);
      return file;
  }

  return resultFile;
}

async function compressWithWorker(file: File, opts: ImageCompressOptions): Promise<File> {
  return new Promise((resolve, reject) => {
    // Create worker
    const worker = new Worker(new URL('./advanced-image-worker.ts', import.meta.url));
    
    worker.onmessage = (e) => {
      const { success, blob, error, meta } = e.data;
      if (success) {
        // Construct filename with new extension if format changed
        let name = file.name;
        if (meta.format === "image/avif" && !name.endsWith(".avif")) {
            name = name.replace(/\.[^.]+$/, ".avif");
        } else if (meta.format === "image/webp" && !name.endsWith(".webp")) {
            name = name.replace(/\.[^.]+$/, ".webp");
        }
        
        const resultFile = new File([blob], name, { type: meta.format });

        // Worker 兜底：如果压缩后体积变大，且不是因为格式转换带来的必要开销（通常不会），则回退
        // 对于 AVIF/WebP，如果体积比原图大，说明原图可能已经极度压缩，或者压缩参数过高。
        // 但由于我们主要目的是“无损”，有时候为了画质可能会牺牲体积（尤其是在 High 模式下）。
        // 不过用户抱怨“变大”，我们应该尽量避免。
        // 如果新文件比原文件大，且原文件也是同类型（不太可能，因为 Worker 输出 AVIF/WebP），或者原文件是 JPEG/PNG，
        // 我们应该怎么做？
        // 策略：如果体积增加了 > 10%，且 SSIM 很高，不如直接返回原图（如果浏览器支持原图格式显示）。
        // 但为了安全起见，我们只在体积显著增加时警告，或者严格限制：如果变大，就返回原图。
        if (resultFile.size > file.size) {
             console.warn(`Advanced compression result larger (${resultFile.size} > ${file.size}), fallback to original.`);
             // 只有当原图是浏览器可直接显示的格式时才返回原图
             if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
                 opts.onProgress?.(100);
                 resolve(file);
                 worker.terminate();
                 return;
             }
        }

        opts.onProgress?.(100);
        resolve(resultFile);
      } else {
        reject(new Error(error));
      }
      worker.terminate();
    };

    worker.onerror = (err) => {
      reject(err);
      worker.terminate();
    };

    // Determine format preference
    // Respect original file type if opts.fileType is not specified
    const requestedType = opts.fileType || file.type;
    let targetFormat: "image/avif" | "image/webp" = "image/avif";
    
    if (requestedType === "image/webp") {
        targetFormat = "image/webp";
    }
    
    opts.onProgress?.(10); // Start progress

    worker.postMessage({
      file,
      options: {
        targetFormat,
        minQuality: 50,
        maxQuality: 95,
        targetSSIM: 0.98
      }
    });
  });
}

