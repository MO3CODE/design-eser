import type { Metadata } from 'next';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import './globals.css';

const plex = IBM_Plex_Sans_Arabic({ subsets: ['arabic', 'latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-plex' });

export const metadata: Metadata = {
  title: 'Design Eser — استوديو التصميم الذكي',
  description: 'ارفع خطة المحتوى، والاستوديو يصمم بنفس محركات المهارات (Güzel Eser · بوابة المستثمر) عبر RadoxAI.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={plex.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
