import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="relative min-h-dvh overflow-hidden room-bg text-[#eef3f0]">
      <div className="pointer-events-none absolute inset-0 room-grid" />
      <div className="lamp-glow pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[rgba(31,122,102,0.35)] blur-3xl" />

      <nav className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-6">
        <span className="font-brand text-xl tracking-tight text-white">情报驱动 · 备战</span>
      </nav>

      <section className="relative z-10 mx-auto flex min-h-[calc(100dvh-88px)] w-full max-w-6xl flex-col justify-center px-5 pb-16 pt-8 sm:px-6">
        <p className="anim-rise text-sm tracking-[0.22em] text-[#7dbaa8]">
          INTEL · TARGETED PRACTICE
        </p>
        <h1 className="anim-rise-delay font-brand mt-5 max-w-4xl text-[clamp(2.4rem,7vw,5rem)] leading-[1.08] text-white">
          先搞清楚怎么考
          <br />
          再针对性开练
        </h1>
        <p className="anim-rise-late mt-6 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
          做一个情报驱动的备战系统：先聚合这家公司、这个岗位怎么考，再结合你的简历和
          JD 针对性模拟，最后告诉你哪里没准备好、下一步只练什么。
        </p>
        <p className="anim-rise-late mt-4 max-w-2xl text-sm leading-relaxed text-white/50">
          不是心理陪伴。用事实把三个「不知道」变成确定：不知道考什么、不知道自己什么水平、不知道下一步干什么。
        </p>
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

        <div className="anim-rise-late mt-20 grid max-w-4xl gap-8 border-t border-white/10 pt-8 sm:grid-cols-3">
          {[
            {
              n: '01',
              t: '岗位情报',
              d: '粘贴、链接或自动检索面经，聚合成高频考点、真实问题和来源可信度。',
            },
            {
              n: '02',
              t: '针对训练',
              d: '按简历 × JD × 情报出题。完整模拟，或只练情报里反复出现的点。',
            },
            {
              n: '03',
              t: '下一步只练 3 个',
              d: '已验证、经不起追问、尚未覆盖。不堆分数，只给今天该补的三件事。',
            },
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
