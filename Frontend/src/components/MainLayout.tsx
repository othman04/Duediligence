import type { ReactNode } from 'react';
import { SidebarLayout } from './Sidebar';

interface MainLayoutProps {
  children: ReactNode;
  activeId?: string;
  onNavClick?: (id: string) => void;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <SidebarLayout>
      {children}
    </SidebarLayout>
  );
}
