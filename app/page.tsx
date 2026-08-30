import Link from 'next/link';
import { HomeStatus } from './components/HomeStatus';

export default function HomePage() {
  return (
    <main className="relative min-h-dvh overflow-hidden room-bg text-[#eef3f0]">
      <div className="pointer-events-none absolute inset-0 room-grid" />
      <div className="lamp-glow pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[rgba(31,122,102,0.35)] blur-3xl" />

      <nav className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-6">
        <span className="font-brand text-xl tracking-tight text-white">情报驱动 · 备战</span>
        <Link
          href="/history"
          className="text-sm text-white/55 transition hover:text-white"
        >
          往期复盘
        </Link>
      </nav>

      <section className="relative z-10 mx-auto grid min-h-[calc(100dvh-88px)] w-full max-w-6xl items-stretch gap-8 px-5 pb-16 pt-4 sm:px-6 lg:grid-cols-2 lg:gap-12">
        <HomeStatus />

        <div className="flex flex-col justify-between">
          <div>
            <p className="anim-rise text-sm text-[#7dbaa8]">面试准备</p>
            <h1 className="anim-rise-delay font-brand mt-5 text-[clamp(2rem,5.4vw,3.6rem)] leading-[1.12] text-white">
              按目标岗位
              <br />
              准备面试
            </h1>
            <p className="anim-rise-late mt-6 max-w-xl text-base leading-relaxed text-white/70">
              汇总该公司、该岗位的公开面经，对照简历与职位描述出题。训练结束后列出已掌握、仍需加强与尚未覆盖的考点。
            </p>
            <div className="anim-rise-late mt-8 grid gap-5 border-t border-white/10 pt-6 sm:grid-cols-3">
              {[
                { n: '1', t: '收集面经', d: '检索该岗位的公开面试记录，按发布时间排序。' },
                { n: '2', t: '针对性训练', d: '依据简历、职位描述与情报生成追问，而不是通用题库。' },
                { n: '3', t: '复盘缺口', d: '保留当场问答，并标出下一步应补的考点。' },
              ].map((item) => (
                <div key={item.n}>
                  <p className="text-xs text-[#7dbaa8]">{item.n}</p>
                  <p className="mt-1.5 font-brand text-lg text-white">{item.t}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/50">{item.d}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="anim-rise-late mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/interview"
              className="btn-primary rounded-md px-6 py-3 text-sm font-medium tracking-wide"
            >
              开始准备
            </Link>
            <Link
              href="/interview?demo=1"
              className="rounded-md border border-white/20 px-6 py-3 text-sm text-white/80 transition hover:border-white/40 hover:text-white"
            >
              查看演示
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
