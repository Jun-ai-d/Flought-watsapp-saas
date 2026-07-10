import React from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import DesktopLayout from './DashboardLayout/DesktopLayout';
import MobileLayout from './DashboardLayout/MobileLayout';

const Layout: React.FC = () => {
  const isMobile = useIsMobile();

  return isMobile ? <MobileLayout /> : <DesktopLayout />;
};

export default Layout;
