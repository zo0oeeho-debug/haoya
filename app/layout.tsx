import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from "@/components/ui/toaster"
import { ModeProvider } from '@/context/mode-context'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PDF Compressor',
  description: 'Professional PDF compression tool',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-50 selection:bg-brand-blue/10 selection:text-brand-blue`}>
        <div id="haoya-bg-layer" className="fixed inset-0 -z-10 h-full w-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
           {/* 深海蓝灰 - 模拟深层海水流动 */}
           <div className="absolute -left-[20%] top-[10%] h-[1000px] w-[1000px] rounded-full bg-blue-200/30 blur-[120px] mix-blend-multiply dark:bg-blue-900/20 dark:mix-blend-screen animate-drift"></div>
           
           {/* 清透青蓝 - 模拟浅层海水 */}
           <div className="absolute -right-[10%] -top-[20%] h-[900px] w-[900px] rounded-full bg-cyan-100/40 blur-[100px] mix-blend-multiply dark:bg-cyan-900/20 dark:mix-blend-screen animate-blob animation-delay-2000"></div>
           
           {/* 灰蓝暗流 - 增加层次感 */}
           <div className="absolute left-[20%] -bottom-[30%] h-[800px] w-[800px] rounded-full bg-slate-300/20 blur-[140px] mix-blend-multiply dark:bg-slate-800/20 dark:mix-blend-screen animate-blob animation-delay-4000"></div>
           
           {/* 顶部高光 - 模拟阳光穿透水面 */}
           <div className="absolute left-[40%] top-[20%] h-[400px] w-[400px] rounded-full bg-blue-50/60 blur-[80px] mix-blend-normal animate-blob animation-delay-1000"></div>

           {/* 极淡的网格纹理 - 保持质感 */}
           <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:48px_48px]"></div>
           <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
        </div>
        <ModeProvider>
          <Toaster>
            {children}
          </Toaster>
        </ModeProvider>
      </body>
    </html>
  )
}
