import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Skolo Saka — R10 a month for the school that made you',
  description: 'A lifelong alumni contribution network for South African primary and high schools.',
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body>{children}<Analytics /></body></html>;
}
