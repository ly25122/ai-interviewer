import Link from 'next/link';
import { HomeStatus } from './components/HomeStatus';

function MarkLogo() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
      <rect x="3" y="6" width="16" height="16" rx="4" fill="#1f9d7a" opacity="0.85" />
      <rect x="13" y="10" width="16" height="16" rx="4" fill="#3ecf9a" />
    </svg>
  );
}

function RocketIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d="M14.5 4.5c2.8 1.2 5.2 3.6 6.4 6.4-2.6.6-5.7-.6-7.6-2.5-1.9-1.9-3.1-5-2.5-7.6 1.1.4 2.4 1.1 3.7 3.7Z"
        fill="currentColor"
      />
      <path d="M13 9.5 5 17.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M6.5 14.5 4 17l2.5-.2L7.2 19 9.5 16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M8.4 5.6v12.8l10.2-6.4L8.4 5.6Z" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="home-shell relative min-h-dvh overflow-hidden text-[#eef3f0]">
      <div className="pointer-events-none absolute inset-0 home-grid" />
      <div className="lamp-glow pointer-events-none absolute -right-16 -top-20 h-[28rem] w-[28rem] rounded-full bg-[rgba(46,184,140,0.22)] blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-[rgba(20,90,75,0.28)] blur-3xl" />

      <nav className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <MarkLogo />
          <div className="min-w-0">
            <p className="text-[17px] font-semibold tracking-tight text-white">情报驱动</p>
            <p className="text-[11px] text-white/45">面试备战</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4 sm:gap-5">
          <Link href="/interview" className="hidden text-sm text-white/80 transition hover:text-white sm:inline">
            我的备战
          </Link>
          <Link href="/history" className="hidden text-sm text-white/80 transition hover:text-white sm:inline">
            历史复盘
          </Link>
          <Link href="/interview?demo=1" className="home-cta inline-flex items-center rounded-full px-4 py-2 text-sm font-medium">
            演示模式
          </Link>
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid min-h-[calc(100dvh-88px)] w-full max-w-6xl items-stretch gap-8 px-5 pb-16 pt-2 sm:px-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-12">
        <HomeStatus />

        <div className="flex flex-col justify-between py-2">
          <div>
            <p className="anim-rise text-sm tracking-wide text-[#7dbaa8]">面试准备</p>
            <h1 className="anim-rise-delay mt-4 text-[clamp(2.1rem,5.2vw,3.55rem)] font-semibold leading-[1.18] tracking-tight text-white">
              先知道怎么考，
              <br />
              再开始准备
            </h1>
            <p className="anim-rise-late mt-6 max-w-xl text-[15px] leading-relaxed text-white/68">
              实习、夏令营都可以。一场一场摸清怎么考，再对照简历练。不是随机刷题，是按情报出题、按缺口复盘。
            </p>
            <div className="anim-rise-late mt-9 grid gap-6 sm:grid-cols-3">
              {[
                { n: '1', t: '看清怎么考', d: '把面经收成这场面试的考点，而不是一份通用题库。' },
                { n: '2', t: '对着简历练', d: '按你写过的项目追问，讲不清的地方当场标出来。' },
                { n: '3', t: '只补缺口', d: '练完告诉你站住了哪些、还差哪三刀，下一步不用猜。' },
              ].map((item) => (
                <div key={item.n}>
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#1f9d7a] text-sm font-semibold text-white">
                    {item.n}
                  </span>
                  <p className="mt-3 text-[15px] font-semibold text-white">{item.t}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-white/48">{item.d}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="anim-rise-late mt-10 flex flex-wrap items-center gap-3">
            <Link
              href="/interview"
              className="home-cta inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium"
            >
              <RocketIcon />
              准备下一场
            </Link>
            <Link
              href="/interview?demo=1"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/5 px-6 py-3 text-sm text-white/90 transition hover:border-white/45 hover:bg-white/10"
            >
              <PlayIcon />
              查看演示
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
