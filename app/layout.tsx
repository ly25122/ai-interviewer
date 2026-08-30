import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '底气 · 让你知道自己准备到哪了',
  description:
    '把散落在小红书、真假混杂的面经，提纯成这个岗位的真实考纲，再变成你个人的准备度地图。',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
