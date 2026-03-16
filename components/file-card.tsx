import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { 
  FileImage, 
  FileText, 
  Download, 
  Trash2, 
  CheckCircle2, 
  Loader2,
  Check
} from "lucide-react";
import { formatBytes, type Mode } from "@/lib/utils/file";
import clsx from "clsx";

export type FileStatus = "pending" | "compressing" | "done" | "error";

export type Item = {
  id: string;
  file: File;
  mode: Mode;
  progress: number;
  status: FileStatus;
  customStatus?: string;
  error?: string | null;
  originalSize: number;
  compressedFile?: File;
  compressedSize?: number;
};

// 简单的类型定义，包含我们需要的配置项
export type GlobalSettings = {
  imageMaxSizeMB: number;
  imageQuality: number;
  imageMaxWidth: number;
  pdfQuality: number;
  pdfMaxWidth: number;
};

interface FileCardProps {
  item: Item;
  onDownload: (item: Item) => void;
  onDelete: (id: string) => void;
  globalSettings?: GlobalSettings;
}

export function FileCard({ item, onDownload, onDelete, globalSettings }: FileCardProps) {
  const savedPercentage = useMemo(() => {
    if (!item.compressedSize || item.originalSize === 0) return 0;
    const saved = 1 - item.compressedSize / item.originalSize;
    return Math.max(0, Math.round(saved * 100));
  }, [item.compressedSize, item.originalSize]);

  const Icon = useMemo(() => {
    switch (item.mode) {
      case "pdf": return FileText;
      default: return FileImage;
    }
  }, [item.mode]);

  // 预估逻辑
  const estimation = useMemo(() => {
    if (item.status !== "pending" || !globalSettings) return null;

    let text = "";
    if (item.mode === "image") {
      // 这里的逻辑只是展示当前设置的目标，不代表真实压缩结果
      // 如果文件本身小于 maxMB，则主要受 Quality 影响
      const maxBytes = globalSettings.imageMaxSizeMB * 1024 * 1024;
      if (item.originalSize > maxBytes) {
         text = `目标 < ${globalSettings.imageMaxSizeMB} MB`;
      } else {
         text = `目标质量 ${(globalSettings.imageQuality * 100).toFixed(0)}%`;
      }
    } else if (item.mode === "pdf") {
      text = `质量 ${(globalSettings.pdfQuality * 100).toFixed(0)}%`;
    }
    
    return text;
  }, [item.status, item.mode, item.originalSize, globalSettings]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className={clsx(
        "group relative flex flex-col gap-2 overflow-hidden rounded-xl p-3 transition-all hover:shadow-lg",
        "border border-white/40 bg-white/60 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/60",
        "shadow-sm hover:bg-white/80 dark:hover:bg-slate-900/80"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left: Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex flex-col min-w-0 flex-1 gap-0.5">
            <div className="flex items-center justify-between">
                <h3 className="truncate text-sm font-medium text-slate-800 dark:text-slate-200 pr-2" title={item.file.name}>
                  {item.file.name}
                </h3>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 h-4">
              {/* Status Text Inline */}
              <span className={clsx(
                  "font-medium flex items-center gap-1",
                  item.status === "error" ? "text-red-500" : 
                  item.status === "done" ? "text-emerald-600 dark:text-emerald-400" : 
                  "text-slate-500 dark:text-slate-400"
                )}>
                  {item.status === "pending" && "等待处理"}
                  {item.status === "compressing" && (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {item.customStatus || `${(item.progress).toFixed(0)}%`}
                    </span>
                  )}
                  {item.status === "done" && (
                    <>
                      <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 shadow-sm">
                        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                      </div>
                      <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent dark:from-emerald-400 dark:to-teal-400">
                        压缩完成
                      </span>
                    </>
                  )}
                  {item.status === "error" && (
                    <>
                      <Trash2 className="h-3 w-3" />
                      <span>{item.error || "压缩失败"}</span>
                    </>
                  )}
              </span>
              
              <span className="w-px h-2.5 bg-slate-200 dark:bg-white/10 mx-0.5" />

              <span>{formatBytes(item.originalSize)}</span>
              {item.compressedSize ? (
                <>
                  <span>→</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {formatBytes(item.compressedSize)}
                  </span>
                </>
              ) : (
                estimation && (
                  <>
                    <span>→</span>
                    <span className="text-slate-400 italic">{estimation}</span>
                  </>
                )
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {item.status === "done" && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="hidden sm:flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30 mr-1"
            >
              <CheckCircle2 className="h-3 w-3" />
              -{savedPercentage}%
            </motion.div>
          )}

          {item.status === "done" && (
            <button
              onClick={() => onDownload(item)}
              className="rounded-full p-1.5 text-slate-500 hover:bg-brand-blue/10 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200 transition-colors"
              title="下载"
            >
              <Download className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={() => onDelete(item.id)}
            className="rounded-full p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:text-slate-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
            title="删除"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress Bar Area - Glassmorphism Style */}
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/5 backdrop-blur-sm mt-1 ring-1 ring-white/20 dark:ring-white/10">
        <motion.div
          className={clsx(
            "absolute h-full rounded-full shadow-[0_0_10px_rgba(255,255,255,0.3)]",
            item.status === "error" 
              ? "bg-gradient-to-r from-red-400/80 to-rose-500/80 backdrop-blur-md"
              : item.status === "done" 
                ? "bg-gradient-to-r from-emerald-400/80 to-teal-500/80 backdrop-blur-md"
                : "bg-gradient-to-r from-emerald-400/80 to-teal-500/80 backdrop-blur-md"
          )}
          initial={{ width: 0 }}
          animate={{ 
            width: `${Math.max(0, Math.min(100, item.progress))}%`
          }}
          transition={{ duration: 0.3 }}
        />
        {/* Shimmer Effect */}
        {(item.status === "compressing" || item.status === "pending") && (
            <motion.div
                className="absolute inset-0 z-10 w-full -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{ translateX: ["-100%", "100%"] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
        )}
      </div>
    </motion.div>
  );
}
