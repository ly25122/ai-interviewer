import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="relative min-h-dvh overflow-hidden room-bg text-[#eef3f0]">
      <div className="pointer-events-none absolute inset-0 room-grid" />
      <div className="lamp-glow pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[rgba(31,122,102,0.35)] blur-3xl" />

      <nav className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-brand text-xl tracking-tight text-white">AI面试官</span>
        <div className="flex items-center gap-5 text-sm text-white/65">
          <Link href="/analyze" className="transition hover:text-white">
            面经甄别
          </Link>
          <Link
            href="/prepare"
            className="rounded-md bg-white/10 px-3.5 py-1.5 text-white transition hover:bg-white/15"
          >
            开始准备
          </Link>
        </div>
      </nav>

      {/* 第一屏：品牌 + 一句主张 + 一组 CTA。不塞统计、日程、卡片墙 */}
      <section className="relative z-10 mx-auto flex min-h-[calc(100dvh-88px)] w-full max-w-6xl flex-col justify-center px-6 pb-16 pt-8">
        <p className="anim-rise text-sm tracking-[0.22em] text-[#7dbaa8]">TECH INTERN · MOCK</p>
        <h1 className="anim-rise-delay font-brand mt-5 max-w-4xl text-[clamp(2.8rem,8vw,5.6rem)] leading-[1.05] text-white">
          AI面试官
        </h1>
        <p className="anim-rise-late mt-6 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
          先从真实面经抽出这岗位要考什么，再追问验证你到底会不会。
        </p>
        <div className="anim-rise-late mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/prepare"
            className="btn-primary rounded-md px-6 py-3 text-sm font-medium tracking-wide"
          >
            进入面试准备
          </Link>
          <Link
            href="/analyze"
            className="rounded-md border border-white/20 px-6 py-3 text-sm text-white/80 transition hover:border-white/40 hover:text-white"
          >
            先看这篇面经能不能信
          </Link>
        </div>

        <div className="anim-rise-late mt-20 grid max-w-3xl gap-8 border-t border-white/10 pt-8 sm:grid-cols-3">
          {[
            { n: '01', t: '建考纲', d: '面经提纯，按可信度加权' },
            { n: '02', t: '自评位', d: '三分钟标出会与不会' },
            { n: '03', t: '真追问', d: '只看有没有新的具体事实' },
          ].map((item) => (
            <div key={item.n}>
              <p className="text-xs tracking-[0.18em] text-[#7dbaa8]">{item.n}</p>
              <p className="mt-2 font-brand text-xl text-white">{item.t}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-white/55">{item.d}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
