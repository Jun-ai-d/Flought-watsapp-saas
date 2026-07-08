import React from 'react';
import { Link } from 'react-router-dom';

interface LogoProps {
  className?: string;
  isWhite?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = '', isWhite = false }) => {
  return (
    <div className={`flex items-center gap-3 cursor-pointer group ${className}`}>
      <div className="w-10 h-10 flex items-center justify-center group-hover:scale-105 transition-all">
        <img src="/logo.png" alt="Flought Logo" className="w-full h-full object-contain" />
      </div>
      <span className={`text-2xl font-bold tracking-tight ${isWhite ? 'text-white' : 'text-[#00221A]'}`}>
        Flought
      </span>
    </div>
  );
};

export const LinkedLogo: React.FC<LogoProps & { to?: string }> = ({ to = '/', ...props }) => {
  return (
    <Link to={to}>
      <Logo {...props} />
    </Link>
  );
};
