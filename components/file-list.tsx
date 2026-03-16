import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatBytes } from "@/lib/utils/file";
import { FileCard, type Item, type GlobalSettings } from "./file-card";
import { Trash2, Sparkles } from "lucide-react";

interface FileListProps {
  items: Item[];
  onDownload: (item: Item) => void;
  onDelete: (id: string) => void;
  onClearAll?: () => void;
  globalSettings?: GlobalSettings;
}

export function FileList({ items, onDownload, onDelete, onClearAll, globalSettings }: FileListProps) {
 if (items.length === 0) return null;
  
  // 如果是 PDF 单文件模式，列表已在 UploadCompressor 中内联展示，这里不重复渲染
  if (items.length === 0) return null;
  
  // 如果是 PDF 单文件模式，列表已在 UploadCompressor 中内联展示，这里不重复渲染
  if (items.length === 1 && items[0].mode === "pdf") {
      // 但这里无法直接获知 pdfSubMode，我们通过 props 传递或者简单的 hack
      // 实际上 UploadCompressor 会负责隐藏这个组件或者 FileList 内部做判断
      // 由于 FileList 是通用组件，最好不要耦合特定业务逻辑
      // 让我们在 UploadCompressor 中控制是否渲染 FileList
  }

  const completedItems = items.filter((i) => i.status === "done" && i.compressedSize);
  const totalOriginal = completedItems.reduce((acc, curr) => acc + curr.originalSize, 0);
  const totalCompressed = completedItems.reduce((acc, curr) => acc + (curr.compressedSize || 0), 0);
  const savedSpace = totalOriginal - totalCompressed;
  const savedPercentage = totalOriginal > 0 ? (savedSpace / totalOriginal) * 100 : 0;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 pb-24">
      {onClearAll && (
        <div className="flex justify-end">
          <button
            onClick={onClearAll}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-slate-500 hover:bg-brand-blue/5 dark:text-slate-400 dark:hover:bg-white/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            一键清空
          </button>
        </div>
      )}
      
      <AnimatePresence mode="popLayout">
        {items.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
          >
            <FileCard
              item={item}
              onDownload={onDownload}
              onDelete={onDelete}
              globalSettings={globalSettings}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* 压缩统计卡片 */}
      <AnimatePresence>
        {completedItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 flex flex-col items-center justify-between gap-4 rounded-xl border border-brand-gray/30 bg-white/40 px-6 py-5 backdrop-blur-sm sm:flex-row dark:border-white/10 dark:bg-white/5"
          >
            <div className="flex items-center gap-3">
            <div>
              <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200">压缩完成汇总</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                已处理 {completedItems.length} 个文件
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400">原大小</div>
              <div className="font-medium text-slate-800 dark:text-slate-200">{formatBytes(totalOriginal)}</div>
            </div>
            <div className="h-8 w-px bg-brand-blue/10 dark:bg-white/10" />
            <div className="text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400">压缩后</div>
              <div className="font-medium text-slate-800 dark:text-slate-200">{formatBytes(totalCompressed)}</div>
            </div>
            <div className="h-8 w-px bg-brand-blue/10 dark:bg-white/10" />
            <div className="text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400">节省空间</div>
              <div className="font-bold text-slate-800 dark:text-slate-200">
                {formatBytes(savedSpace)} <span className="text-xs font-normal opacity-80">(-{savedPercentage.toFixed(1)}%)</span>
              </div>
            </div>
          </div>
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
