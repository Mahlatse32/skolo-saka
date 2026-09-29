import type { ReactNode } from 'react';
import AdminAccessBoundary from '../components/AdminAccessBoundary';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminAccessBoundary area="analytics">{children}</AdminAccessBoundary>;
}
