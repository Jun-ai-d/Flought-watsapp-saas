import React from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import DesktopMarketingLayout from './DesktopMarketingLayout';
import MobileMarketingLayout from './MobileMarketingLayout';

const MarketingLayout: React.FC = () => {
  const isMobile = useIsMobile();

  return isMobile ? <MobileMarketingLayout /> : <DesktopMarketingLayout />;
};

export default MarketingLayout;