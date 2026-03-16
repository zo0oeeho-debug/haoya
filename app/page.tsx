import { UploadCompressor } from "@/components/upload-compressor";
import { TopNav } from "@/components/ui/top-nav";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      <TopNav />
      <div className="content-wrapper mx-auto flex w-full max-w-[960px] flex-1 flex-col justify-center gap-6 px-4 py-6 sm:gap-8 sm:py-10 -mt-[60px]">
        <section aria-label="媒体压缩面板">
          <UploadCompressor />
        </section>

        <header className="site-title space-y-3 pt-2 sm:pt-4 text-center flex flex-col items-center mt-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-blue/10 bg-brand-white/60 px-3 py-1 text-xs text-slate-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
            100% 浏览器端压缩。保护你的创意，更保护你的隐私。
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl text-slate-800">
            免费，免注册，万千细节，减负呈现
          </h1>
          <p className="text-sm leading-6 text-slate-500 dark:text-slate-400 max-w-2xl">
            <strong className="font-semibold text-slate-700 dark:text-slate-200">支持 PDF、PNG、GIF、JPG 与 SVG 压缩。</strong><br/>
            所有的复杂处理，均在浏览器本地全速进行。你的文件从未离开，隐私归于隐私。<br/>
            针对较大的 PDF，它甚至能为你自动拆分。<br/>
            从批量操作到实时进度，一切大任，皆能分毫毕现，轻而易举。
          </p>
        </header>
      </div>
    </main>
  );
}
