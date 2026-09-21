import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { Suspense } from 'react';
import AnalyticsTracker from './AnalyticsTracker';
import PaymentQuickLink from './PaymentQuickLink';
import './globals.css';
import './profile.css';
import './trust.css';
import './secondary.css';
import './mobile-nav-badge.css';

export const metadata: Metadata = {
  title: 'Skolo Saka — R10 a month for the school that made you',
  description: 'A lifelong alumni contribution network for South African primary and high schools.',
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body>{children}<PaymentQuickLink/><Suspense fallback={null}><AnalyticsTracker/></Suspense><Analytics /></body></html>;
}
