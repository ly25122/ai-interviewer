import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="relative min-h-dvh overflow-hidden room-bg text-[#eef3f0]">
      <div className="pointer-events-none absolute inset-0 room-grid" />
      <div className="lamp-glow pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[rgba(31,122,102,0.35)] blur-3xl" />

      <nav className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-6">
        <span className="font-brand text-xl tracking-tight text-white">AI面试官</span>
      </nav>

      <section className="relative z-10 mx-auto flex min-h-[calc(100dvh-88px)] w-full max-w-6xl flex-col justify-center px-5 pb-16 pt-8 sm:px-6">
        <p className="anim-rise text-sm tracking-[0.22em] text-[#7dbaa8]">
          RESUME · MOCK INTERVIEW
        </p>
        <h1 className="anim-rise-delay font-brand mt-5 max-w-4xl text-[clamp(2.6rem,7.5vw,5.2rem)] leading-[1.05] text-white">
          先改简历
          <br />
          再按它开面
        </h1>
        <p className="anim-rise-late mt-6 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
          对照岗位 JD 把简历改到能经得起追问，再用这份简历做模拟面试。
          师兄经验、牛客帖、微信整理的面经——都放进面试里当辅助，不单独成一个产品。
          也可以按公司/岗位自动检索公开面经。
        </p>
        <div className="anim-rise-late mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/interview"
            className="btn-primary rounded-md px-6 py-3 text-sm font-medium tracking-wide"
          >
            开始：改简历并模拟面试
          </Link>
          <Link
            href="/interview"
            className="rounded-md border border-white/20 px-6 py-3 text-sm text-white/80 transition hover:border-white/40 hover:text-white"
          >
            先看一遍演示
          </Link>
        </div>

        <div className="anim-rise-late mt-20 grid max-w-3xl gap-8 border-t border-white/10 pt-8 sm:grid-cols-2">
          {[
            {
              n: '01',
              t: '改简历',
              d: '对照 JD 和面经，把虚的收一收、缺口补上、自己讲不清的别写。',
            },
            {
              n: '02',
              t: '模拟面试',
              d: '按改完的简历 × 岗位 JD 出题深挖。面经只在这里辅助出题。',
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
