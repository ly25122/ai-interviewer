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
  title: 'AI面试官 · 改简历，再按它开面',
  description:
    '对照岗位 JD 改简历，再用这份简历做模拟面试。面经只在面试里当辅助。面向大厂技术实习。',
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
