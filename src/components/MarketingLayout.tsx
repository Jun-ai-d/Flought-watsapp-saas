import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { LinkedLogo, Logo } from './Logo';

const MarketingLayout: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#00221A] overflow-x-hidden font-sans selection:bg-[#002E23] selection:text-white">
      
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md border-b border-[#EAEAEA] py-4 shadow-sm' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <LinkedLogo />
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#4A6B5D]">
            <Link to="/" className={`hover:text-[#002E23] transition-colors ${location.pathname === '/' ? 'text-[#00221A] font-semibold' : ''}`}>Home</Link>
            <Link to="/features" className={`hover:text-[#002E23] transition-colors ${location.pathname === '/features' ? 'text-[#00221A] font-semibold' : ''}`}>Features</Link>
            <Link to="/pricing" className={`hover:text-[#002E23] transition-colors ${location.pathname === '/pricing' ? 'text-[#00221A] font-semibold' : ''}`}>Pricing</Link>
          </div>
          
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-[#4A6B5D] hover:text-[#002E23] transition-colors hidden sm:block">Log In</Link>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link to="/signup" className="px-5 py-2.5 text-sm font-semibold text-white bg-[#002E23] rounded-xl flex items-center gap-2 hover:bg-[#00392C] transition-all shadow-md">
                Start Free Trial
                <ArrowRight size={16} />
              </Link>
            </motion.div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main className="relative z-10 pt-28">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-[#EAEAEA] bg-white text-center text-[#4A6B5D] z-20 relative mt-24">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <Logo />
          
          <div className="flex flex-wrap gap-8 justify-center text-sm font-medium">
            <Link to="/features" className="hover:text-[#002E23] transition-colors">Features</Link>
            <Link to="/pricing" className="hover:text-[#002E23] transition-colors">Pricing</Link>
            <Link to="/privacy" className="hover:text-[#002E23] transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-[#002E23] transition-colors">Terms</Link>
          </div>
        </div>
        <div className="mt-16 pt-8 border-t border-[#EAEAEA] text-sm">
          <p>© 2026 JMK Enterprises. All rights reserved. Flought is a product of JMK Enterprises.</p>
        </div>
      </footer>
    </div>
  );
};

export default MarketingLayout;