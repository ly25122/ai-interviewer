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
            <p className="anim-rise text-sm tracking-[0.22em] text-[#7dbaa8]">
              INTEL · TARGETED PRACTICE
            </p>
            <h1 className="anim-rise-delay font-brand mt-5 text-[clamp(2rem,5.4vw,3.6rem)] leading-[1.12] text-white">
              先搞清楚怎么考
              <br />
              再针对性开练
            </h1>
            <p className="anim-rise-late mt-6 max-w-xl text-base leading-relaxed text-white/70">
              情报驱动的备战系统：先聚合这家公司、这个岗位怎么考，再结合你的简历和
              JD 针对性模拟，最后告诉你哪里没准备好、下一步只练什么。
            </p>
            <p className="anim-rise-late mt-4 max-w-xl text-sm leading-relaxed text-white/50">
              不是心理陪伴。用事实把三个「不知道」变成确定：不知道考什么、不知道自己什么水平、不知道下一步干什么。
            </p>
            <div className="anim-rise-late mt-8 grid gap-5 border-t border-white/10 pt-6 sm:grid-cols-3">
              {[
                { n: '01', t: '岗位情报', d: '聚合成高频考点、真实问题和来源。' },
                { n: '02', t: '针对训练', d: '按简历 × JD × 情报出题。' },
                { n: '03', t: '只练 3 个', d: '不堆分数，只给今天该补的。' },
              ].map((item) => (
                <div key={item.n}>
                  <p className="text-xs tracking-[0.18em] text-[#7dbaa8]">{item.n}</p>
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
              开始备战
            </Link>
            <Link
              href="/interview?demo=1"
              className="rounded-md border border-white/20 px-6 py-3 text-sm text-white/80 transition hover:border-white/40 hover:text-white"
            >
              先看一遍演示
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
