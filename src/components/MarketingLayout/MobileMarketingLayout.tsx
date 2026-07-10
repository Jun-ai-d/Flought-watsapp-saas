import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LinkedLogo, Logo } from '../Logo';

const MobileMarketingLayout: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#00221A] overflow-x-hidden font-sans selection:bg-[#002E23] selection:text-white flex flex-col">
      
      {/* Mobile Header */}
      <nav className={`fixed top-0 left-0 right-0 z-[60] transition-all duration-300 ${scrolled || menuOpen ? 'bg-white/95 backdrop-blur-md border-b border-[#EAEAEA] py-3 shadow-sm' : 'bg-transparent py-4'}`}>
        <div className="px-5 flex items-center justify-between">
          <LinkedLogo />
          
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#00221A] bg-gray-50 border border-gray-100 focus:outline-none"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-white pt-20 px-6 pb-6 flex flex-col h-screen overflow-y-auto"
          >
            <div className="flex flex-col gap-6 mt-8 text-xl font-bold text-[#00221A]">
              <Link to="/" className={`py-2 border-b border-gray-100 ${location.pathname === '/' ? 'text-[#002E23]' : ''}`}>Home</Link>
              <Link to="/features" className={`py-2 border-b border-gray-100 ${location.pathname === '/features' ? 'text-[#002E23]' : ''}`}>Features</Link>
              <Link to="/pricing" className={`py-2 border-b border-gray-100 ${location.pathname === '/pricing' ? 'text-[#002E23]' : ''}`}>Pricing</Link>
            </div>
            
            <div className="mt-auto pt-10 flex flex-col gap-4">
              <Link to="/login" className="w-full py-4 text-center text-lg font-semibold text-[#002E23] bg-gray-50 rounded-xl border border-gray-100">
                Log In
              </Link>
              <Link to="/signup" className="w-full py-4 text-center text-lg font-bold text-white bg-[#002E23] rounded-xl flex justify-center items-center gap-2 shadow-lg shadow-[#002E23]/20">
                Start Free Trial
                <ArrowRight size={18} />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Content */}
      <main className="relative z-10 pt-20 flex-1">
        <Outlet />
      </main>

      {/* Mobile Footer */}
      <footer className="py-12 px-5 border-t border-[#EAEAEA] bg-white text-center text-[#4A6B5D] z-20 relative mt-16">
        <div className="flex flex-col items-center gap-8">
          <Logo />
          
          <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm font-medium w-full max-w-xs text-left">
            <Link to="/features" className="hover:text-[#002E23]">Features</Link>
            <Link to="/pricing" className="hover:text-[#002E23]">Pricing</Link>
            <Link to="/privacy" className="hover:text-[#002E23]">Privacy</Link>
            <Link to="/terms" className="hover:text-[#002E23]">Terms</Link>
            <Link to="/refund" className="hover:text-[#002E23] col-span-2 text-center mt-2">Refund Policy</Link>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-[#EAEAEA] text-xs">
          <p>© 2026 JMK Enterprises. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default MobileMarketingLayout;
