import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { MessageSquare, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const MarketingLayout: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-gray-900 overflow-x-hidden font-sans selection:bg-[#C1440E] selection:text-white">
      
      {/* Brutalist Grid Background */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
      </div>

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${scrolled ? 'bg-white border-b-2 border-black py-3' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 cursor-pointer group">
            <div className="w-10 h-10 bg-[#C1440E] border-2 border-black flex items-center justify-center shadow-[2px_2px_0_0_#000] group-hover:translate-x-[2px] group-hover:translate-y-[2px] group-hover:shadow-none transition-all">
              <MessageSquare size={18} className="text-white" />
            </div>
            <span className="text-2xl font-black tracking-tight text-black uppercase">Flought</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-bold text-black font-['Courier_Prime']">
            <Link to="/" className={`hover:text-[#C1440E] uppercase transition-colors ${location.pathname === '/' ? 'text-[#C1440E] underline decoration-2 underline-offset-4' : ''}`}>Home</Link>
            <Link to="/features" className={`hover:text-[#C1440E] uppercase transition-colors ${location.pathname === '/features' ? 'text-[#C1440E] underline decoration-2 underline-offset-4' : ''}`}>Features</Link>
            <Link to="/pricing" className={`hover:text-[#C1440E] uppercase transition-colors ${location.pathname === '/pricing' ? 'text-[#C1440E] underline decoration-2 underline-offset-4' : ''}`}>Pricing</Link>
          </div>
          
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-bold text-black hover:text-[#C1440E] transition-colors hidden sm:block font-['Courier_Prime'] uppercase">Log In</Link>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}>
              <Link to="/signup" className="px-5 py-2.5 text-sm font-black text-white bg-[#C1440E] border-2 border-black flex items-center gap-2 shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all uppercase">
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
      <footer className="py-16 px-6 border-t-2 border-black bg-white text-center text-black font-['Courier_Prime'] font-bold z-20 relative mt-24">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center justify-center gap-3">
            <div className="w-8 h-8 bg-[#C1440E] border-2 border-black flex items-center justify-center shadow-[2px_2px_0_0_#000]">
              <MessageSquare size={14} className="text-white" />
            </div>
            <span className="text-xl font-black text-black uppercase tracking-tight">Flought</span>
          </div>
          
          <div className="flex flex-wrap gap-6 justify-center">
            <Link to="/features" className="hover:text-[#C1440E] transition-colors uppercase">Features</Link>
            <Link to="/pricing" className="hover:text-[#C1440E] transition-colors uppercase">Pricing</Link>
            <Link to="/privacy" className="hover:text-[#C1440E] transition-colors uppercase">Privacy</Link>
            <Link to="/terms" className="hover:text-[#C1440E] transition-colors uppercase">Terms</Link>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t-2 border-black/10 text-sm">
          <p>SYSTEM.COPYRIGHT © 2026 FLOUGHT INC. ALL RIGHTS RESERVED.</p>
        </div>
      </footer>
    </div>
  );
};

export default MarketingLayout;
