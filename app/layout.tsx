import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { Noto_Sans_SC, Noto_Serif_SC } from 'next/font/google';
import './globals.css';

const sans = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-sans',
  display: 'swap',
});

const serif = Noto_Serif_SC({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-noto-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: '情报驱动 · 面试备战',
  description:
    '先聚合这家公司、这个岗位怎么考，再结合简历和 JD 针对性模拟，最后告诉你哪里没准备好、下一步只练什么。',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="zh-CN"
      data-scroll-behavior="smooth"
      className={`h-full antialiased ${sans.variable} ${serif.variable}`}
    >
      <body
        className="min-h-full flex flex-col"
        style={
          {
            '--body': 'var(--font-noto-sans), "PingFang SC", "Hiragino Sans GB", sans-serif',
            '--brand': 'var(--font-noto-serif), "Songti SC", serif',
          } as CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
