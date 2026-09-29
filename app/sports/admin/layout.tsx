import type { ReactNode } from 'react';
import AdminAccessBoundary from '../../components/AdminAccessBoundary';

export default function SportsAdminLayout({ children }: { children: ReactNode }) {
  return <AdminAccessBoundary area="sports">{children}</AdminAccessBoundary>;
}
