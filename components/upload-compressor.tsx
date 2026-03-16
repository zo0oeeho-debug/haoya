"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useDeferredValue } from "react";
import Image from "next/image";
import clsx from "clsx";
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";
import { ACCEPT_MAP, type Mode, validateFileForMode } from "@/lib/utils/file";
import { DropZone } from "@/components/ui/drop-zone";
import { FileList } from "@/components/file-list";
import { type Item } from "@/components/file-card";
import { compressImage } from "@/lib/compression/image-compressor";
import { compressPdf, analyzePdfSample, splitPdf } from "@/lib/compression/pdf-compressor";
import { Download, Trash2, Play, RefreshCw, Archive, File, Files, ArrowDown, Scissors, GripHorizontal } from "lucide-react";
import { formatBytes } from "@/lib/utils/file";
import { useMode } from "@/context/mode-context";
import { CustomSlider } from "@/components/ui/custom-slider";

function CountUpNumber({ value, formatter = (v: number) => v.toFixed(1) }: { value: number, formatter?: (v: number) => string }) {
  const spring = useSpring(value, { mass: 0.8, stiffness: 75, damping: 15 });
  const display = useTransform(spring, (current) => formatter(current));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span>{display}</motion.span>;
}

export function UploadCompressor() {
  const { mode, setMode } = useMode();
  const [pdfSubMode, setPdfSubMode] = useState<"single" | "batch">("single");
  // 新增 PDF 动作状态：compress (常规压缩) | split (大文件拆分)
  const [pdfAction, setPdfAction] = useState<"compress" | "split">("compress");
  const pdfActionRef = useRef<"compress" | "split">("compress");
  const dragCounter = useRef(0);

  // 初始化时确保是单个文件模式
  useEffect(() => {
    if (mode === "pdf") {
      setPdfSubMode("single");
    }
  }, [mode]);

  // Sync ref with state
  useEffect(() => {
    pdfActionRef.current = pdfAction;
  }, [pdfAction]);
  const [dragActive, setDragActive] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [isZipping, setIsZipping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // PDF 预估分析状态
  const [pdfAnalysis, setPdfAnalysis] = useState<{ totalPages: number, totalSize: number, sampleSize?: number } | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState<number>(0);
  const [pdfSampleSize, setPdfSampleSize] = useState<number>(0);
  const analyzedFileIdRef = useRef<string | null>(null);

  // 简约模式状态
  const [imageStrength, setImageStrength] = useState<"high" | "recommended" | "extreme">("high");
  // 动效状态：控制向下箭头
  const [showDownArrow, setShowDownArrow] = useState(false);
  const prevImageStrength = useRef<"high" | "recommended" | "extreme">("high");

  // 监听 imageStrength 变化以触发动效
  useEffect(() => {
    const strengthOrder = { high: 0, recommended: 1, extreme: 2 };
    const prev = strengthOrder[prevImageStrength.current];
    const curr = strengthOrder[imageStrength];

    // 如果是向“更小体积”方向变化 (high -> recommended -> extreme)
    if (curr > prev) {
      setShowDownArrow(true);
      // 动画持续时间后自动隐藏
      const timer = setTimeout(() => setShowDownArrow(false), 300);
      return () => clearTimeout(timer);
    } else {
      // 如果是反向变化（变大），立即隐藏
      setShowDownArrow(false);
    }
    
    prevImageStrength.current = imageStrength;
  }, [imageStrength]);

  const [pdfCompressionLevel, setPdfCompressionLevel] = useState<number>(50); // 0-100, 50 is default (Recommended)
  // 使用 deferredValue 优化滑块性能，将 UI 更新与昂贵的预估计算分离
  const deferredCompressionLevel = useDeferredValue(pdfCompressionLevel);
  
  const [pdfSplitParts, setPdfSplitParts] = useState<number>(2); // 默认拆分为2份

  const [imageFormat, setImageFormat] = useState<"original" | "image/webp">("original");
  const [imageSize, setImageSize] = useState<"original" | "1920" | "1080">("original");

  const accept = useMemo(() => ACCEPT_MAP[mode], [mode]);
  const processingRef = useRef(false);

  // 监听 PDF 文件变化进行分析 (Expensive - Only runs when first item changes)
  const firstItemId = items[0]?.id;
  useEffect(() => {
    if (mode !== "pdf" || !firstItemId) {
      setPdfPageCount(0);
      analyzedFileIdRef.current = null;
      return;
    }

    const firstItem = items[0];
    if (!firstItem || firstItem.file.type !== "application/pdf") {
      setPdfPageCount(0);
      return;
    }
    
    // Prevent re-analysis of the same file ID
    if (analyzedFileIdRef.current === firstItem.id) {
        return;
    }

    const analyze = async () => {
      try {
        // Fix: Use arrayBuffer immediately to avoid multiple file reads
        // Note: analyzePdfSample already handles arrayBuffer internally, but here we just pass the file.
        // The optimization is that we only call this ONCE per file.
        const { pageCount, sampleSize } = await analyzePdfSample(firstItem.file);
        setPdfPageCount(pageCount);
        setPdfSampleSize(sampleSize || 0);
        analyzedFileIdRef.current = firstItem.id;
      } catch (e) {
        console.error("PDF analyze failed:", e);
        setPdfPageCount(0);
        setPdfSampleSize(0);
      }
    };
    analyze();
  }, [firstItemId, mode]);

  // Update total size (Cheap - Runs on every item update)
  useEffect(() => {
    if (mode !== "pdf" || items.length === 0) {
      setPdfAnalysis(null);
      return;
    }
    const totalSize = items.reduce((acc, item) => acc + (item.status === "pending" ? item.file.size : item.originalSize), 0);
    setPdfAnalysis({ totalPages: pdfPageCount, totalSize, sampleSize: pdfSampleSize });
  }, [items, pdfPageCount, pdfSampleSize, mode]);

  // 计算派生参数
  const imageSettings = useMemo(() => {
    let quality = 0.75;
    let maxSizeMB = 1;
    let maxWidth = 3840;

    // 智能优化策略 (提升整体质量标准)：
    // 通过限制分辨率来大幅减小体积，从而可以使用更高的 Quality 参数，
    // 这样在视觉上图片更清晰，但文件体积反而更小。
    switch (imageStrength) {
      case "high":
        // 无损模式：
        // 调整为 0.88 (视觉无损黄金点)，在肉眼几乎无法区分的情况下，
        // 相比原图通常能减少 40-70% 的体积。0.95 往往会导致体积缩减不明显甚至变大。
        quality = 0.88;
        maxSizeMB = 10;
        maxWidth = 3840;
        break;
      case "recommended":
        // 推荐模式：Quality 0.5 -> 0.75, MaxWidth 2048 -> 2560 (2.5K)
        // 提升清晰度，略微增加体积
        quality = 0.75; 
        maxSizeMB = 5;
        maxWidth = 2560;
        break;
      case "extreme":
        // 最小体积模式：Quality 0.1 -> 0.4, MaxWidth 1600 -> 1920 (FHD)
        // 即使是最小体积，也保证基本的 1080p 可用性，避免过于模糊
        quality = 0.4;
        maxSizeMB = 1;
        maxWidth = 1920;
        break;
    }

    // 如果用户之前手动选择了尺寸（虽然现在 UI 隐藏了，但逻辑保留），则覆盖默认策略
    if (imageSize === "1920") maxWidth = 1920;
    if (imageSize === "1080") maxWidth = 1080;

    return { quality, maxSizeMB, maxWidth };
  }, [imageStrength, imageSize]);



  const pdfSettings = useMemo(() => {
    // 将 0-100 的滑块值映射到具体的压缩参数
    // 0 (High/Lossless): Quality 0.95, Ratio 0.98
    // 50 (Recommended): Quality 0.85, Ratio 0.8
    // 100 (Extreme): Quality 0.6, Ratio 0.5
    
    // 使用 deferred 值避免高频重计算
    const level = deferredCompressionLevel;
    
    // 反向映射：level 越大，压缩越狠 (quality 越低)
    // Quality: 0.95 -> 0.6 (大幅提升下限，原先最低是 0.4)
    const quality = 0.95 - (level / 100) * 0.35; 
    
    // MaxWidth: 3840 -> 1920 (提升分辨率下限，最低也有 1080p+)
    const maxWidth = 3840 - (level / 100) * 1920;
    
    // Ratio (for estimation): 0.98 -> 0.5
    const ratio = 0.98 - (level / 100) * 0.48;

    return { quality, maxWidth, ratio };
  }, [deferredCompressionLevel]);

  // PDF 实时预估计算
  const pdfEstimation = useMemo(() => {
    if (!pdfAnalysis || pdfAnalysis.totalSize === 0) return null;
    
    let estimatedSize: number;
    const level = deferredCompressionLevel;

    if (pdfAnalysis.sampleSize && pdfAnalysis.sampleSize > 0) {
        // 基于采样的精准预估
        // 1. 基础估算：采样页大小 * 总页数
        const baseEstimate = pdfAnalysis.sampleSize * pdfAnalysis.totalPages;
        
        // 2. 质量因子修正：相对于采样质量 (0.6) 的缩放
        // JPEG 大小与质量的关系是非线性的，通常在高质量段增长更快
        // 使用 1.5 次方作为启发式拟合
        const qualityFactor = Math.pow(pdfSettings.quality / 0.6, 1.5);
        
        // 3. 分辨率因子修正：相对于采样宽度 (1600px) 的缩放
        // 图像面积与宽度的平方成正比
        const resolutionFactor = Math.pow(pdfSettings.maxWidth / 1600, 2);
        
        // 4. 综合计算
        estimatedSize = baseEstimate * qualityFactor * resolutionFactor;
        
        // 5. 加上 PDF 结构开销 (每页约 2KB)
        estimatedSize += pdfAnalysis.totalPages * 2048;
        
        // 采样估算修正：确保不超过原体积
        // 因为采样可能正好采到大图，导致估算偏大
        if (estimatedSize >= pdfAnalysis.totalSize) {
             estimatedSize = pdfAnalysis.totalSize * 0.98;
        }

    } else {
        // 降级回退：使用简单的比例映射
        // 调整映射系数，使其更贴近实际压缩效果（通常 PDF 压缩比没那么夸张，除非全是图片）
        // 无损模式 (ratio 0.95) -> 估算 90%
        // 推荐模式 (ratio 0.7) -> 估算 60%
        // 最小体积 (ratio 0.4) -> 估算 30%
        const realRatio = pdfSettings.ratio * 0.9; 
        estimatedSize = pdfAnalysis.totalSize * realRatio;
    }
    
    // 边界处理 1: 至少 1KB
    if (estimatedSize < 1024) estimatedSize = 1024; 
    
    // 边界处理 2: 估算体积不能超过原体积（因为我们有兜底策略，最差也是返回原文件）
    // 且为了用户体验，即使在无损模式下，我们也可以稍微乐观一点，显示 98% 左右，避免用户觉得没效果
    if (estimatedSize >= pdfAnalysis.totalSize) {
        estimatedSize = pdfAnalysis.totalSize * 0.98;
    }

    const savedBytes = pdfAnalysis.totalSize - estimatedSize;
    const savedPercent = Math.round((savedBytes / pdfAnalysis.totalSize) * 100);
    
    let tips = "";
    if (level < 30) tips = "无损模式：保留最高细节，仅移除冗余数据";
    else if (level < 70) tips = "推荐配置：平衡清晰度与体积，适合大多数场景";
    else tips = "最小体积：适合手机阅读，打印可能会有颗粒感";
    
    return {
      original: pdfAnalysis.totalSize,
      estimated: estimatedSize,
      savedPercent,
      tips
    };
  }, [pdfAnalysis, pdfSettings, deferredCompressionLevel]);

  // 计算预估节省 (Generic logic for other modes if needed, but pdfEstimation handles PDF specifically)
  const estimatedSavings = useMemo(() => {
    let base = 0;
    const strength = imageStrength;
    
    switch (strength) {
      case "high": base = 30; break;
      case "recommended": base = 60; break;
      case "extreme": base = 90; break;
    }
    
    if (mode === "image") {
        if (imageFormat === "image/webp") base += 15;
        if (imageSize !== "original") base += 20;
    }
    return Math.min(99, base);
  }, [mode, imageStrength, imageFormat, imageSize]);

  const globalSettings = useMemo(() => ({
    imageQuality: imageSettings.quality,
    imageMaxSizeMB: imageSettings.maxSizeMB,
    imageMaxWidth: imageSettings.maxWidth,
    pdfQuality: pdfSettings.quality,
    pdfMaxWidth: pdfSettings.maxWidth
  }), [
    imageSettings,
    pdfSettings
  ]);

  const reset = useCallback(() => {
    setItems([]);
    setIsZipping(false);
    setError(null);
    setIsProcessing(false);
    processingRef.current = false;
    setPdfAnalysis(null);
  }, []);

  // 切换模式或 PDF 子模式时重置
  useEffect(() => {
    reset();
  }, [mode, pdfSubMode, reset]);

  const deleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  // 核心压缩逻辑
  const processItem = useCallback(
    async (item: Item) => {
      try {
        let out: File;
        const onProgress = (p: number) => {
          setItems((prev) =>
            prev.map((it) => (it.id === item.id ? { ...it, progress: p } : it))
          );
        };
        
        // Custom status updater
        const updateStatus = (status: string, p: number) => {
             setItems((prev) =>
            prev.map((it) => (it.id === item.id ? { ...it, progress: p, customStatus: status } : it))
          );
        };

        if (item.mode === "image") {
          out = await compressImage(item.file, {
            maxSizeMB: imageSettings.maxSizeMB,
            maxWidthOrHeight: imageSettings.maxWidth,
            initialQuality: imageSettings.quality,
            fileType: imageFormat === "original" ? undefined : imageFormat,
            onProgress
          });
        } else {
          // Check action from ref to ensure latest value
          const action = pdfActionRef.current;

          // 如果是拆分动作
          if (mode === "pdf" && pdfSubMode === "single" && action === "split") {
            try {
              // 1. 先进行压缩 (复用压缩逻辑)
              // Update status: "正在压缩..."
              updateStatus("正在压缩...", 10);
              
              const compressedFile = await compressPdf(item.file, {
                imageQuality: pdfSettings.quality,
                maxWidth: pdfSettings.maxWidth,
                // 压缩占前 50% 的进度
                onProgress: (p) => updateStatus("正在压缩...", 10 + p * 0.4) 
              });

              // 2. 再进行拆分 (使用压缩后的文件)
              // If pdfSplitParts is 0, it means "Auto Split" (target 10MB)
              // If > 0, it means manual split
              const splitOptions = {
                parts: pdfSplitParts > 0 ? pdfSplitParts : undefined,
                targetSizeBytes: 10 * 1024 * 1024, // Default 10MB target
                // 拆分占后 50% 的进度
                onProgress: (status: string, p: number) => updateStatus(status, 50 + p * 0.5)
              };
              
              out = await splitPdf(compressedFile, splitOptions);
              
              // 自动触发下载
              const url = URL.createObjectURL(out);
              const a = document.createElement("a");
              a.href = url;
              a.download = out.name;
              a.click();
              URL.revokeObjectURL(url);
            } catch (e) {
              console.error("Split failed:", e);
              throw e;
            }
          } else {
            out = await compressPdf(item.file, {
              imageQuality: pdfSettings.quality,
              maxWidth: pdfSettings.maxWidth,
              onProgress
            });
          }
        }

        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: "done",
                  progress: 100,
                  compressedFile: out,
                  compressedSize: out.size,
                  customStatus: undefined // Clear custom status
                }
              : it
          )
        );
      } catch (e) {
        console.error("Process item error:", e);
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { 
                  ...it, 
                  status: "error", 
                  error: e instanceof Error ? e.message : "处理失败，请重试", 
                  progress: 0, 
                  customStatus: undefined 
                }
              : it
          )
        );
      }
    },
    [imageSettings, imageFormat, pdfSettings, mode, pdfSubMode, pdfSplitParts] // Removed pdfAction dependency as we use ref
  );

  // 队列处理器
  useEffect(() => {
  const processQueue = async () => {
    // 队列处理器
    // 为了防止重入，但也要允许 startAll 触发的任务被执行
    if (processingRef.current) return;
    
    // 查找下一个待处理任务
    // 优先级：
    // 1. compressing 且 progress 为 0 (新开始的任务)
    // 2. pending (非 PDF 模式的自动任务，或者 PDF 批量模式)
    
    let pendingItem;
    if (mode === "pdf") {
       if (pdfSubMode === "single") {
          // 单文件模式：必须是 compressing
          pendingItem = items.find((it) => it.status === "compressing" && it.progress === 0);
       } else {
          // 批量模式：compressing 或 pending
          pendingItem = items.find((it) => (it.status === "compressing" && it.progress === 0) || it.status === "pending");
       }
    } else {
       pendingItem = items.find((it) => it.status === "pending");
    }
    
    if (!pendingItem) {
      setIsProcessing(false);
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);

    // 状态修正 (对于 pending 的任务，转为 compressing)
    if (pendingItem.status === "pending") {
      setItems((prev) =>
        prev.map((it) =>
          it.id === pendingItem.id ? { ...it, status: "compressing", progress: 1, error: null } : it
        )
      );
    }

    // 关键修复：确保在 processItem 执行时传递正确的 PDF 参数
    // 之前可能因为闭包问题导致 split 参数未更新，现在我们直接从 state 读取最新值传递给 processItem
    // 但 processItem 是 useCallback 包裹的，依赖项已经包含了 pdfSplitParts 等。
    // 只要 processItem 的依赖项正确，闭包就没问题。
    await processItem(pendingItem);

    processingRef.current = false;
  };

    processQueue();
  }, [items, processItem, mode]);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);

      const incoming = Array.from(files);
      const validItems: Item[] = [];
      const now = Date.now();

      let shouldReplace = false;

      // 校验 PDF 模式下的单文件/多文件逻辑
      if (mode === "pdf") {
         // 自动模式切换逻辑：
         // 1. 如果当前是 single 模式，但用户传了多个文件 -> 自动切到 batch 模式
         // 2. 如果当前是 batch 模式，但用户只传了一个文件 -> 保持 batch 模式
         if (pdfSubMode === "single" && incoming.length > 1) {
            setPdfSubMode("batch");
         } 
         // 3. 如果是 single 模式，已有一个文件，又传了一个新文件 -> 标记为替换
         else if (pdfSubMode === "single" && incoming.length === 1 && items.length > 0) {
             shouldReplace = true;
         }
         // 4. 如果是 single 模式，已有文件，又传了多个文件 -> 上面已经切到 batch，这里会走到 batch 逻辑（追加）
         
         // 移除之前的报错逻辑
         /* if (pdfSubMode === "single" && items.length > 0) {
            setError("单文件模式仅支持一个文件，请先删除现有文件");
            return;
         } */
         
         // 智能诊断：如果是单文件模式（或即将成为单文件）且文件很大 (>50MB)，自动计算建议拆分份数
         if (incoming.length === 1 && incoming[0].size > 50 * 1024 * 1024) {
            const suggestedParts = Math.ceil(incoming[0].size / (20 * 1024 * 1024));
            setPdfSplitParts(Math.min(suggestedParts, 10));
         }
      }

      for (let idx = 0; idx < incoming.length; idx++) {
        const f = incoming[idx];
        const err = validateFileForMode(f, mode);
        if (err) {
          setError(err);
          continue;
        }
        
        // 决定初始状态：
        // 1. 如果是 PDF 且是批量模式 (incoming > 1 或当前已经是 batch) -> compressing (自动开始)
        // 2. 如果是 PDF 且是单文件模式 (incoming === 1 且当前是 single) -> pending (等待确认)
        // 3. 其他模式 -> pending
        
        // 注意：由于 setPdfSubMode 是异步的，我们需要根据 incoming.length 预判
        const isBatch = (mode === "pdf" && (pdfSubMode === "batch" || incoming.length > 1));
        const initialStatus: "pending" | "compressing" = isBatch ? "compressing" : "pending";

        validItems.push({
          id: `${now}-${idx}-${f.name}`,
          file: f,
          mode,
          progress: 0,
          status: initialStatus,
          originalSize: f.size
        });
      }

      if (validItems.length > 0) {
        if (shouldReplace) {
            setItems(validItems);
            // 重置分析状态
            setPdfAnalysis(null);
            setPdfPageCount(0);
            setPdfSampleSize(0);
            analyzedFileIdRef.current = null;
        } else {
            setItems((prev) => [...prev, ...validItems]);
        }
      }
    },
    [mode, pdfSubMode, items.length] 
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      dragCounter.current = 0;
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // 保持 active 状态，防止某些浏览器行为导致的闪烁
    if (!dragActive) setDragActive(true);
  }, [dragActive]);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      setDragActive(false);
      dragCounter.current = 0;
    }
  }, []);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      e.target.value = "";
    },
    [handleFiles]
  );

  const downloadSingle = useCallback((item: Item) => {
    if (!item.compressedFile) return;
    const url = URL.createObjectURL(item.compressedFile);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.compressedFile.name;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const downloadAllZip = useCallback(async () => {
    const completed = items.filter((it) => it.status === "done" && it.compressedFile);
    if (completed.length === 0) return;
    setIsZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      for (const it of completed) {
        if (!it.compressedFile) continue;
        const arrayBuffer = await it.compressedFile.arrayBuffer();
        zip.file(it.compressedFile.name, arrayBuffer);
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "localpress_batch.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      setError("打包失败，请重试");
    } finally {
      setIsZipping(false);
    }
  }, [items]);

  const startAll = useCallback(() => {
    // 立即更新状态，强制触发 UI 刷新和 useEffect
    setItems((prev) =>
      prev.map((it) => {
        // 对于 PDF 模式，我们需要确保：
        // 1. 如果是 pending，转为 compressing
        // 2. 如果是 error/done，重置为 compressing
        // 3. 进度归零
        // 4. 如果是 PDF 单文件模式，无论当前状态如何，只要点击开始，就强制重新开始 (支持重复拆分)
        if (
            (mode === "pdf" && (it.status === "pending" || (pdfSubMode === "single" && items.length > 0))) || 
            it.status === "error" ||
            it.status === "done" // Allow restart for done items too in PDF single mode
        ) {
           return { ...it, status: "compressing", progress: 0, error: null, customStatus: undefined };
        }
        return it;
      })
    );
    
    // 强制设置 processingRef 为 false，以允许 useEffect 重新捕获任务
    processingRef.current = false;
    // 触发处理逻辑
    setIsProcessing(true);
  }, [mode, pdfSubMode, items.length]);

  return (
    <div className="mx-auto flex w-full flex-col gap-6">
      <div className={clsx(
        "flex w-full flex-col gap-5 rounded-3xl border p-10 backdrop-blur-lg transition-all",
        // 当内容少时（无文件且非单文件模式），固定高度以保持布局稳定；有内容时自适应高度
        // items.length === 0 ? "min-h-[480px]" : "h-auto",
        "min-h-[480px] mt-10",
        "border-brand-gray/80 bg-brand-white/80 shadow-blue-glow hover:shadow-blue-hover",
        "dark:border-white/10 dark:bg-gradient-to-b dark:from-slate-950/75 dark:to-slate-900/75 dark:shadow-[0_18px_60px_rgba(15,23,42,0.75)]"
      )}>
        {/* 顶部控制栏区域 (PDF 模式选择 / Image 压缩强度选择) */}
        <div className="flex justify-center my-1">
          {mode === "pdf" ? (
            <div className="relative flex items-center p-[9px] bg-slate-200/30 dark:bg-slate-800/30 rounded-full">
              {[
                { id: "single", label: "单个文件压缩" },
                { id: "batch", label: "批量文件压缩" },
              ].map((tab) => {
                const isActive = pdfSubMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setPdfSubMode(tab.id as any)}
                    className={clsx(
                      "relative flex items-center gap-2 px-6 py-2.5 text-sm font-medium transition-colors duration-300 rounded-full outline-none z-10",
                      isActive
                        ? "text-slate-900 dark:text-white"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="pdf-mode-bubble"
                        className="absolute inset-0 -z-10 rounded-full bg-white dark:bg-slate-600 shadow-sm"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <span className="flex items-center gap-2">
                      <span>{tab.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="relative flex items-center p-[9px] bg-slate-200/30 dark:bg-slate-800/30 rounded-full">
              {[
                { id: "high", label: "无损", sub: "88%" },
                { id: "recommended", label: "推荐", sub: "75%" },
                { id: "extreme", label: "最小", sub: "40%" },
              ].map((opt) => {
                const isActive = imageStrength === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setImageStrength(opt.id as any)}
                    className={clsx(
                      "relative flex items-center gap-2 px-6 py-2.5 text-sm font-medium transition-colors duration-300 rounded-full outline-none z-10",
                      isActive
                        ? "text-slate-900 dark:text-white"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="image-mode-bubble"
                        className="absolute inset-0 -z-10 rounded-full bg-white dark:bg-slate-600 shadow-sm"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <span className="flex items-center gap-1.5">
                      <span>{opt.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DropZone 
          active={dragActive} 
          mode={mode} // Pass the current mode to DropZone
          onDrop={onDrop} 
          onDragOver={onDragOver} 
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onClick={() => document.getElementById("file-input")?.click()}
          className="flex-1 min-h-0 relative"
        >

          <input id="file-input" type="file" multiple accept={accept} onChange={onFileChange} className="hidden" />

          {/* 如果是 PDF 单文件模式且有文件，则内联显示文件处理面板，隐藏拖拽提示 */}
          {mode === "pdf" && pdfSubMode === "single" && items.length > 0 && pdfEstimation ? (
             <div className="w-full max-w-xl">
               <div className="flex flex-col gap-6" onClick={(e) => e.stopPropagation()}>
                
                {/* 1. 文件预览与状态 */}
                {items[0] && (
                  <div className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-white/10 my-10">
                    
                    {/* Info */}
                    <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                      <div className="truncate text-sm font-medium text-slate-900 dark:text-white" title={items[0].file.name}>
                        {items[0].file.name}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>{formatBytes(items[0].originalSize)}</span>
                        {items[0].status === "done" && items[0].compressedSize && (
                          <>
                            <span>→</span>
                            <span className="font-bold text-slate-800 dark:text-white">{formatBytes(items[0].compressedSize)}</span>
                          </>
                        )}
                        {items[0].status === "compressing" && (
                          <span className="text-slate-800 dark:text-blue-400">
                             {items[0].customStatus ? (
                               <>
                                 {items[0].customStatus} <span className="opacity-60">{items[0].progress.toFixed(0)}%</span>
                               </>
                             ) : (
                               `处理中... ${items[0].progress.toFixed(0)}%`
                             )}
                          </span>
                        )}
                        {items[0].status === "error" && (
                          <span className="text-red-500">{items[0].error || "处理失败"}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                       {items[0].status === "done" && items[0].compressedFile && (
                          <button
                             onClick={() => downloadSingle(items[0])}
                             className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-blue/10 text-slate-700 transition-colors hover:bg-brand-blue hover:text-white dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                             title="下载"
                          >
                             <Download className="h-4 w-4" />
                          </button>
                       )}
                       <button
                          onClick={reset}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                          title="删除"
                       >
                          <Trash2 className="h-4 w-4" />
                       </button>
                    </div>
                  </div>
                )}

               </div>
             </div>
          ) : (
            <>
              {mode === "image" ? (
                 <div className="pointer-events-none mb-6 h-32 w-32 transition-transform group-hover:scale-110 relative">
                    <motion.div
                       initial={{ opacity: 0, scale: 0.8, y: 10 }}
                       animate={{ opacity: 1, scale: 1, y: 0 }}
                       transition={{ 
                          type: "spring",
                          stiffness: 300,
                          damping: 25,
                          duration: 0.4
                       }}
                    >
                       <Image
                          src="/images/img-glass-icon.png"
                          alt="Upload Image"
                          width={128}
                          height={128}
                          className="object-contain drop-shadow-2xl"
                          priority
                       />
                    </motion.div>
                    <AnimatePresence>
                      {/* Only show arrow animation when reducing file size (high -> recommended -> extreme) */}
                      {showDownArrow && (
                        <motion.div 
                          className="absolute right-0 top-3 z-20 pointer-events-none flex flex-col items-center -space-y-3"
                        >
                           <svg width="0" height="0" className="absolute">
                             <defs>
                               <linearGradient id="arrow-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                 <stop offset="0%" stopColor="#4ade80" />
                                 <stop offset="100%" stopColor="#16a34a" />
                               </linearGradient>
                             </defs>
                           </svg>
                           {[0, 1].map((i) => (
                             <motion.div
                               key={i}
                               initial={{ y: -10, opacity: 0 }}
                               animate={{ y: 0, opacity: i === 0 ? 1 : 0.5 }}
                               exit={{ y: 5, opacity: 0 }}
                               transition={{ 
                                 duration: 0.15, 
                                 delay: i * 0.04,
                                 ease: "easeOut" 
                               }}
                             >
                               <ArrowDown 
                                 className="h-6 w-6 drop-shadow-sm" 
                                 style={{ stroke: "url(#arrow-gradient)", strokeWidth: 4 }}
                               />
                             </motion.div>
                           ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                 </div>
              ) : (
                  <div className="relative pointer-events-none mb-6 h-32 w-32 transition-transform group-hover:scale-110">
                     <AnimatePresence mode="popLayout">
                       {pdfSubMode === "batch" ? (
                         <motion.div
                           key="batch-pdf"
                           className="absolute inset-0 h-full w-full"
                           initial={{ opacity: 0, scale: 0.8 }}
                           animate={{ opacity: 1, scale: 1 }}
                           exit={{ opacity: 0, scale: 0.8 }}
                           transition={{ duration: 0.2 }}
                         >
                           {/* Back Layer 2 */}
                           <motion.div
                             className="absolute inset-0 opacity-40 grayscale-[0.3]"
                             initial={{ x: 0, scale: 0.9, rotate: 0 }}
                             animate={{ x: 25, y: -5, scale: 0.85, rotate: 5 }}
                             transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.05 }}
                           >
                              <Image src="/images/pdf-glass-icon.png" alt="" width={128} height={128} className="object-contain" />
                           </motion.div>
                           
                           {/* Back Layer 1 */}
                           <motion.div
                             className="absolute inset-0 opacity-70 grayscale-[0.1]"
                             initial={{ x: 0, scale: 0.95, rotate: 0 }}
                             animate={{ x: 13, y: 0, scale: 0.92, rotate: 2 }}
                             transition={{ type: "spring", stiffness: 300, damping: 20 }}
                           >
                              <Image src="/images/pdf-glass-icon.png" alt="" width={128} height={128} className="object-contain" />
                           </motion.div>

                           {/* Main Front Layer */}
                           <motion.div
                             className="absolute inset-0 z-10"
                             initial={{ x: 0 }}
                             animate={{ x: -10 }}
                             transition={{ type: "spring", stiffness: 300, damping: 20 }}
                           >
                              <Image src="/images/pdf-glass-icon.png" alt="Batch PDF" width={128} height={128} className="object-contain drop-shadow-2xl" priority />
                           </motion.div>
                         </motion.div>
                       ) : (
                         <motion.div
                           key="single-pdf"
                           className="absolute inset-0 h-full w-full"
                           initial={{ opacity: 0, scale: 0.8 }}
                           animate={{ opacity: 1, scale: 1, x: 0 }}
                           exit={{ opacity: 0, scale: 0.8 }}
                           transition={{ duration: 0.2 }}
                         >
                            <Image
                               src="/images/pdf-glass-icon.png"
                               alt="Upload PDF"
                               width={128}
                               height={128}
                               className="object-contain drop-shadow-2xl"
                               priority
                            />
                         </motion.div>
                       )}
                     </AnimatePresence>
                  </div>
               )}

              <p className="mb-2 text-base font-normal text-slate-500 dark:text-slate-50 flex items-center justify-center">
                拖拽文件到此处，或
                <label
                  htmlFor="file-input"
                  className="cursor-pointer rounded-lg bg-white px-2 py-1 text-sm text-slate-600 transition-all hover:bg-gray-50 hover:text-slate-800 hover:shadow-[0_0_15px_rgba(59,130,246,0.15)] ml-2.5 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20 dark:hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                >
                  点击选择文件
                </label>
              </p>

              {error && <p className="mt-3 text-sm text-slate-500">{error}</p>}
            </>
          )}
        </DropZone>



        {/* PDF 模式下的实时预估面板 (仅在 single 模式且有文件时显示) */}
        {mode === "pdf" && pdfSubMode === "single" && items.length > 0 && pdfEstimation && (
          <div className="rounded-2xl border border-brand-gray/80 bg-brand-gray/10 p-6 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/70">
             <div className="flex flex-col gap-6">
                
                {/* 智能诊断：超大文件提示 - 已被新的 UX Flow 替代，移除旧版卡片 */}
                {/* {items[0].originalSize > 50 * 1024 * 1024 && pdfAnalysis && (
                   <div className="rounded-xl border border-amber-200/50 bg-amber-50/80 p-4 dark:border-amber-500/20 dark:bg-amber-900/20">
                      ...
                   </div>
                )} */}

                {/* 压缩强度与预估体积 */}
                <div className={clsx(
                  "grid grid-cols-1 gap-8 items-start transition-all duration-300",
                  // pdfAction === "split" ? "opacity-40 grayscale pointer-events-none select-none" : "opacity-100"
                  "opacity-100"
                )}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <label className="text-sm font-medium text-black/60 dark:text-slate-300">压缩强度调节</label>
                         <div className="flex items-center gap-3">
                            <span className="text-xs text-black/30 dark:text-slate-500 line-through">
                               {formatBytes(pdfEstimation.original)}
                            </span>
                            <span className="flex items-center gap-1.5 text-sm font-bold text-black/80 dark:text-white">
                               ~<CountUpNumber value={pdfEstimation.estimated / 1024 / 1024} /> MB
                            </span>
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                               -{pdfEstimation.savedPercent}%
                            </span>
                         </div>
                    </div>
                    
                    {/* 复用滑块组件 - iOS Style with Haptic Feedback */}
                    <div className="relative mb-8 w-full">
                      <CustomSlider
                        value={pdfCompressionLevel}
                         onValueCommit={(val) => setPdfCompressionLevel(val)}
                         min={0}
                         max={100}
                         step={1}
                        className="h-10 py-0"
                         trackClassName="h-4 bg-slate-100 ring-1 ring-black/5 dark:bg-slate-800 dark:ring-white/10"
                         thumbClassName="h-6 w-12 rounded-full"
                         renderThumb={() => <GripHorizontal className="h-4 w-4 text-brand-blue" />}
                       />

                       {/* Labels */}
                        <div className="absolute top-10 mt-1 flex w-full justify-between px-1 text-xs font-medium text-slate-400 select-none dark:text-slate-500">
                         <span className="cursor-pointer transition-colors duration-200 hover:text-black/80" onClick={() => setPdfCompressionLevel(0)}>无损</span>
                         <span className="cursor-pointer transition-colors duration-200 hover:text-black/80" onClick={() => setPdfCompressionLevel(50)}>推荐</span>
                         <span className="cursor-pointer transition-colors duration-200 hover:text-black/80" onClick={() => setPdfCompressionLevel(100)}>最小体积</span>
                       </div>
                    </div>
                    

                    </div>
                  </div>
                    
                {/* 确认并开始压缩按钮 */}
                <button
                  onClick={startAll}
                  disabled={isProcessing}
                  className={clsx(
                    "group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-full px-6 py-3 transition-all my-5",
                    // Dynamic styling based on action
                    pdfAction === "split" 
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600 hover:shadow-emerald-500/40 active:scale-[0.98]"
                      : "bg-brand-blue text-white shadow-lg shadow-brand-blue/25 hover:bg-brand-blue/90 hover:shadow-brand-blue/40 active:scale-[0.98]",
                    "disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                >
                  <div className="relative z-10 flex items-center gap-2 font-medium">
                    {isProcessing ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>正在{pdfAction === "split" ? "拆分" : "压缩"}...</span>
                      </>
                    ) : (
                      <>
                        {pdfAction === "split" ? <Scissors className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
                        <span>开始{pdfAction === "split" ? "拆分" : "压缩"}</span>
                      </>
                    )}
                  </div>
                  {/* 光效背景 */}
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
                </button>
                    
                {/* 拆分设置区域 (始终显示，作为可选功能) */}
                <div className={clsx(
                   "mt-2 border-t border-brand-gray/10 pt-4 transition-all duration-300 dark:border-white/5",
                   pdfAction === "split" ? "opacity-100" : "opacity-80 hover:opacity-100"
                )}>
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className={clsx(
                            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                            pdfAction === "split" ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-brand-gray/10 text-black/30 dark:bg-white/5 dark:text-slate-500"
                         )}>
                            <Scissors className="h-4 w-4" />
                         </div>
                         <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                               <span className={clsx(
                                  "text-[15px] font-medium transition-colors",
                                  pdfAction === "split" ? "text-black/80 dark:text-slate-200" : "text-black/50 dark:text-slate-400"
                               )}>自动拆分</span>
                               
                               {/* Switch moved here, next to title */}
                               <label className="relative inline-flex cursor-pointer items-center ml-2">
                                 <input 
                                    type="checkbox" 
                                    className="peer sr-only"
                                    checked={pdfAction === "split"}
                                    onChange={(e) => {
                                       const isChecked = e.target.checked;
                                       setPdfAction(isChecked ? "split" : "compress");
                                       if (isChecked) {
                                          const suggestedParts = Math.max(2, Math.ceil(pdfEstimation.estimated / (10 * 1024 * 1024)));
                                          setPdfSplitParts(suggestedParts); 
                                       }
                                    }}
                                 />
                                 <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-all after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full peer-focus:outline-none dark:bg-slate-700 dark:after:bg-slate-200 shadow-inner"></div>
                               </label>
                            </div>
                            <span className="text-[10px] text-black/30 dark:text-slate-500">
                               将文件平均拆为多份
                            </span>
                         </div>
                      </div>
                   </div>

                   {/* 拆分份数调节器 (使用 height 动画展开) */}
                   <div className={clsx(
                      "grid transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                      pdfAction === "split" ? "grid-rows-[1fr] opacity-100 mt-4" : "grid-rows-[0fr] opacity-0 mt-0"
                   )}>
                      <div className="overflow-hidden">
                         <div className="rounded-xl border border-brand-gray/10 bg-brand-gray/5 p-4 dark:border-white/10 dark:bg-white/5">
                            <div className="flex items-center justify-between mb-2">
                               <div className="flex flex-col gap-0.5">
                                  <span className="text-sm font-medium text-black/50 dark:text-slate-400">拆分设置</span>
                                  <div className="flex items-center gap-1.5 text-xs text-black/30 dark:text-slate-500">
                                     <span>当前拆分:</span>
                                     <span className="font-bold text-black/80 dark:text-white">{pdfSplitParts} 份</span>
                                  </div>
                               </div>
                               
                               <div className="flex flex-col items-end gap-0.5">
                                  <span className="text-xs text-black/30 dark:text-slate-500">预计每份大小</span>
                                  <span className="rounded-md bg-white px-2 py-0.5 text-sm font-bold text-black/80 shadow-sm dark:bg-slate-700 dark:text-white">
                                     {formatBytes(pdfEstimation.estimated / pdfSplitParts)}
                                  </span>
                               </div>
                            </div>

                            {/* 自定义滑块 */}
                           <div className="relative mt-4 mx-2 h-12">
                              <CustomSlider
                                 value={pdfSplitParts}
                                 onValueCommit={(val) => setPdfSplitParts(val)}
                                 min={2}
                                 max={20}
                                 step={1}
                                 className="h-8 py-0"
                                 trackClassName="h-3 bg-slate-100 ring-1 ring-black/5 dark:bg-slate-800 dark:ring-white/10"
                                 rangeClassName="bg-emerald-500 group-hover:bg-emerald-500/90 group-active:bg-emerald-500/80"
                                 thumbClassName="h-6 w-10 rounded-full group-active:shadow-[0_0_0_4px_rgba(16,185,129,0.2)]"
                                 renderThumb={(val) => (
                                     <span className="text-[11px] font-bold text-black/80">{val}</span>
                                 )}
                              />
                               
                               {/* Labels */}
                               <div className="absolute top-8 flex w-full justify-between px-1 text-[11px] font-medium text-slate-400 select-none dark:text-slate-500">
                                  <span>2</span>
                                  <span>10</span>
                                  <span>20</span>
                               </div>
                           </div>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* 仅在非 PDF 单文件模式下显示底部的 FileList */}
      {!(mode === "pdf" && pdfSubMode === "single") && (
        <FileList 
          items={items} 
          onDownload={downloadSingle} 
          onDelete={deleteItem}
          onClearAll={reset}
          globalSettings={globalSettings}
        />
      )}

      {/* 底部全局控制栏 - 同样在 PDF 单文件模式下隐藏，因为操作已内联 */}
      {items.length > 0 && !(mode === "pdf" && pdfSubMode === "single") && (
        <div className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-32px)] max-w-fit -translate-x-1/2 items-center justify-between gap-2 rounded-full border border-white/20 bg-brand-white/80 p-2 pl-4 pr-2 shadow-2xl backdrop-blur-xl dark:bg-slate-900/80 sm:bottom-8 sm:w-auto sm:gap-3 sm:p-3 sm:pl-5 sm:pr-3">
          <div className="mr-1 text-xs font-medium text-black/80 dark:text-slate-200 sm:mr-2 sm:text-sm whitespace-nowrap">
            {items.filter(i => i.status === "done").length} / {items.length} 完成
          </div>
          
          <div className="h-4 w-px bg-brand-gray dark:bg-white/10 sm:h-5" />

          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-black/50 hover:bg-brand-blue/5 dark:hover:bg-white/10 transition-colors sm:gap-2 sm:px-4 sm:py-2 sm:text-sm whitespace-nowrap"
          >
            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            一键清空
          </button>

          <button
            onClick={downloadAllZip}
            disabled={isZipping || items.filter(i => i.status === "done").length === 0}
            className={clsx(
              "ml-1 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium text-white shadow-lg shadow-brand-blue/20 transition-all sm:ml-2 sm:gap-2 sm:px-5 sm:py-2.5 sm:text-sm whitespace-nowrap",
              "bg-gradient-to-r from-brand-blue to-indigo-600 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            )}
          >
            {isZipping ? <RefreshCw className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" /> : <Archive className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            {isZipping ? "打包中..." : "下载全部 ZIP"}
          </button>
        </div>
      )}
    </div>
  );
}
