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
  title: 'AI面试官 · 用真实面经练到会',
  description:
    '把小红书面经提纯成岗位考纲，自评定位，再用追问验证你到底会不会——面向大厂技术实习的 AI 面试官。',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="zh-CN" className={`h-full antialiased ${sans.variable} ${serif.variable}`}>
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
