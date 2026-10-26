import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Entre Contas — Cassiano & Kethellen',
  description: 'Sua vida financeira, a dois. Contas, escolhas e planos em um só lugar.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Entre Contas', statusBarStyle: 'default' },
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#1e4d3b' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
