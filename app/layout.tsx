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
  title: '情报驱动 面试备战',
  description:
    '实习或夏令营都可以。先摸清下一场怎么考，再对照简历练，最后告诉你哪里没准备好、下一步只练什么。',
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
