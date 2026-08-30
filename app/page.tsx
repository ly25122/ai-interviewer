import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="relative min-h-dvh overflow-hidden room-bg text-[#eef3f0]">
      <div className="pointer-events-none absolute inset-0 room-grid" />
      <div className="lamp-glow pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[rgba(31,122,102,0.35)] blur-3xl" />

      <nav className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-6">
        <span className="font-brand text-xl tracking-tight text-white">AI面试官</span>
        <div className="flex items-center gap-4 text-sm text-white/65 sm:gap-5">
          <Link href="/interview" className="transition hover:text-white">
            简历面试
          </Link>
          <Link href="/prepare" className="transition hover:text-white">
            面经准备
          </Link>
          <Link href="/analyze" className="hidden transition hover:text-white sm:inline">
            面经甄别
          </Link>
        </div>
      </nav>

      <section className="relative z-10 mx-auto flex min-h-[calc(100dvh-88px)] w-full max-w-6xl flex-col justify-center px-5 pb-16 pt-8 sm:px-6">
        <p className="anim-rise text-sm tracking-[0.22em] text-[#7dbaa8]">TECH INTERN · MOCK</p>
        <h1 className="anim-rise-delay font-brand mt-5 max-w-4xl text-[clamp(2.8rem,8vw,5.6rem)] leading-[1.05] text-white">
          AI面试官
        </h1>
        <p className="anim-rise-late mt-6 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
          对照你的简历和岗位 JD 出题深挖；也能用真实面经建考纲，再验证你会不会。
        </p>
        <div className="anim-rise-late mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/interview"
            className="btn-primary rounded-md px-6 py-3 text-sm font-medium tracking-wide"
          >
            上传简历开始面试
          </Link>
          <Link
            href="/prepare"
            className="rounded-md border border-white/20 px-6 py-3 text-sm text-white/80 transition hover:border-white/40 hover:text-white"
          >
            用面经准备
          </Link>
        </div>

        <div className="anim-rise-late mt-20 grid max-w-3xl gap-8 border-t border-white/10 pt-8 sm:grid-cols-3">
          {[
            { n: '01', t: '简历 × JD', d: '重合点、泡沫点、缺口点' },
            { n: '02', t: '一路深挖', d: '只认新增的具体事实' },
            { n: '03', t: '面经考纲', d: '真假面经提纯后再练' },
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
