import React from 'react';
import { ArrowRight, Bot, Zap, ShieldCheck, Database, MessageSquare, ArrowUpRight, ShoppingCart, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useTransform } from 'framer-motion';

// Helper component for 3D Tilt Card
const TiltCard = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const mouseXSpring = x; 
  const mouseYSpring = y;
  
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`perspective-1000 ${className}`}
    >
      <div style={{ transform: "translateZ(30px)" }} className="h-full">
        {children}
      </div>
    </motion.div>
  );
};

const Home: React.FC = () => {
  return (
    <div className="flex flex-col w-full bg-[#f1f5f9]">
      {/* Hero Section */}
      <section className="relative pt-32 pb-40 overflow-hidden border-b-[16px] border-[#C1440E] bg-white">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:64px_64px]"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
          <div className="inline-block border-2 border-black px-4 py-1 mb-8 bg-white font-['Courier_Prime'] font-bold text-xs uppercase shadow-[4px_4px_0_0_#000]">
            <span className="text-[#C1440E] mr-2">●</span> v2.0 SYSTEM ONLINE
          </div>
          <h1 className="text-7xl md:text-[8rem] font-black tracking-tighter leading-[0.9] text-black mb-8 uppercase">
            Put your WhatsApp <br />
            <span className="text-transparent" style={{ WebkitTextStroke: "2px black" }}>On Autopilot.</span>
          </h1>
          <p className="text-xl md:text-2xl text-black/80 max-w-3xl mx-auto mb-12 font-['Courier_Prime'] font-bold leading-relaxed border-l-4 border-[#C1440E] pl-6 text-left">
            Not a generic chatbot. A complete WhatsApp OS with native <strong className="text-black bg-[#C1440E]/10 px-1">Shopify & CRM sync</strong>, automated <strong className="text-black bg-[#C1440E]/10 px-1">Drip Campaigns</strong>, and strict <strong className="text-black bg-[#C1440E]/10 px-1">pgvector RAG</strong> to resolve 80% of support and sales queries instantly.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95, y: 4, x: 4 }}>
              <Link to="/signup" className="flex items-center gap-3 bg-[#C1440E] text-white px-8 py-5 text-xl font-black uppercase border-4 border-black shadow-[8px_8px_0_0_#000] hover:shadow-[4px_4px_0_0_#000] transition-all">
                Start Trial <ArrowRight size={24} />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95, y: 4, x: 4 }}>
              <Link to="/features" className="flex items-center gap-3 bg-white text-black px-8 py-5 text-xl font-black uppercase border-4 border-black shadow-[8px_8px_0_0_#C1440E] hover:shadow-[4px_4px_0_0_#C1440E] transition-all">
                View Specs
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Logos Section */}
      <section className="py-6 border-b-2 border-black bg-white overflow-hidden">
        <div className="flex whitespace-nowrap animate-[scroll_20s_linear_infinite] items-center gap-16 font-['Courier_Prime'] font-bold text-sm text-black/50 uppercase tracking-widest">
          {Array(8).fill(0).map((_, i) => (
            <React.Fragment key={i}>
              <span>Trusted by:</span>
              <span className="flex items-center gap-2"><div className="w-3 h-3 bg-black"></div> ACME CORP</span>
              <span className="flex items-center gap-2"><div className="w-3 h-3 border-2 border-black rounded-full"></div> GLOBEX</span>
              <span className="flex items-center gap-2"><div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent border-b-black"></div> INITECH</span>
              <span className="flex items-center gap-2"><div className="w-3 h-3 bg-black rounded-sm rotate-45"></div> SOYLENT</span>
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* The Problem / Solution Grid */}
      <section className="py-32 border-b-2 border-black">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-16 border-l-8 border-black pl-8">
            <h2 className="text-5xl md:text-7xl font-black text-black uppercase leading-none mb-4">
              The status quo <br/> is broken.
            </h2>
            <p className="font-['Courier_Prime'] font-bold text-black/50 uppercase tracking-widest">Compare your current process.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 md:gap-8">
            {/* Legacy Box */}
            <TiltCard>
              <div className="bg-white border-4 border-black p-8 shadow-[12px_12px_0_0_#000] relative h-full flex flex-col">
                <div className="absolute -top-4 -right-4 bg-black text-white w-8 h-8 flex items-center justify-center font-['Courier_Prime'] font-bold rotate-12 border-2 border-black">
                  X
                </div>
                <h3 className="text-2xl font-black uppercase mb-8 pb-4 border-b-4 border-black">
                  Legacy Operations
                </h3>
                <ul className="space-y-6 font-['Courier_Prime'] font-bold text-lg">
                  <li className="flex items-start gap-4 border-b-2 border-black/10 pb-4">
                    <span className="text-black bg-black/10 px-2 py-1">&gt;</span>
                    Sales leads go cold while waiting for replies.
                  </li>
                  <li className="flex items-start gap-4 border-b-2 border-black/10 pb-4">
                    <span className="text-black bg-black/10 px-2 py-1">&gt;</span>
                    Agents repeat the same answers manually.
                  </li>
                  <li className="flex items-start gap-4 border-b-2 border-black/10 pb-4">
                    <span className="text-black bg-black/10 px-2 py-1">&gt;</span>
                    No visibility into what customers are asking.
                  </li>
                  <li className="flex items-start gap-4">
                    <span className="text-black bg-black/10 px-2 py-1">&gt;</span>
                    Scaling volume requires hiring more heads.
                  </li>
                </ul>
              </div>
            </TiltCard>

            {/* Flought Box */}
            <TiltCard>
              <div className="bg-[#C1440E] border-4 border-black p-8 shadow-[12px_12px_0_0_#000] text-white relative h-full flex flex-col">
                <div className="absolute -top-4 -right-4 bg-white text-black w-8 h-8 flex items-center justify-center font-['Courier_Prime'] font-bold -rotate-12 border-2 border-black">
                  ✓
                </div>
                <h3 className="text-2xl font-black uppercase mb-8 pb-4 border-b-4 border-black">
                  The Flought System
                </h3>
                <ul className="space-y-6 font-['Courier_Prime'] font-bold text-lg">
                  <li className="flex items-start gap-4 border-b-2 border-black/20 pb-4">
                    <span className="text-[#C1440E] bg-white px-2 py-1">&gt;</span>
                    Drip campaigns capture & convert leads 24/7.
                  </li>
                  <li className="flex items-start gap-4 border-b-2 border-black/20 pb-4">
                    <span className="text-[#C1440E] bg-white px-2 py-1">&gt;</span>
                    Vector RAG instantly resolves 80% of FAQs.
                  </li>
                  <li className="flex items-start gap-4 border-b-2 border-black/20 pb-4">
                    <span className="text-[#C1440E] bg-white px-2 py-1">&gt;</span>
                    Dashboard Analytics tracks hot topics & sentiment.
                  </li>
                  <li className="flex items-start gap-4">
                    <span className="text-[#C1440E] bg-white px-2 py-1">&gt;</span>
                    Infinite scale. Humans only handle escalations.
                  </li>
                </ul>
              </div>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-32 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex justify-between items-end mb-16 border-b-4 border-black pb-8">
            <div className="border-l-8 border-[#C1440E] pl-8">
              <h2 className="text-5xl md:text-7xl font-black text-black uppercase leading-none mb-4">
                Core Tech.
              </h2>
              <p className="font-['Courier_Prime'] font-bold text-black/50 uppercase tracking-widest">Built for performance.</p>
            </div>
            <Link to="/features" className="hidden md:flex items-center gap-2 font-['Courier_Prime'] font-bold text-sm uppercase border-2 border-black px-4 py-2 hover:bg-black hover:text-white transition-colors shadow-[4px_4px_0_0_#C1440E]">
              Read Docs <ArrowUpRight size={16} />
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="border-4 border-black p-6 hover:-translate-y-2 transition-transform bg-[#f1f5f9] shadow-[8px_8px_0_0_#000]">
              <div className="w-12 h-12 bg-black flex items-center justify-center mb-6">
                <Database size={24} className="text-white" />
              </div>
              <h3 className="text-xl font-black uppercase mb-4">Vector RAG</h3>
              <p className="font-['Courier_Prime'] font-bold text-sm text-black/70">
                Native pgvector integration for lightning-fast similarity search on your PDFs and website data. Zero hallucinations.
              </p>
            </div>

            <div className="border-4 border-black p-6 hover:-translate-y-2 transition-transform bg-white shadow-[8px_8px_0_0_#000]">
              <div className="w-12 h-12 bg-black flex items-center justify-center mb-6">
                <ShoppingCart size={24} className="text-white" />
              </div>
              <h3 className="text-xl font-black uppercase mb-4">Commerce Sync</h3>
              <p className="font-['Courier_Prime'] font-bold text-sm text-black/70">
                Deep Shopify integration. Automatically pull catalogs, handle order statuses, and process carts via WhatsApp.
              </p>
            </div>

            <div className="border-4 border-black p-6 hover:-translate-y-2 transition-transform bg-[#f1f5f9] shadow-[8px_8px_0_0_#000]">
              <div className="w-12 h-12 bg-black flex items-center justify-center mb-6">
                <Activity size={24} className="text-white" />
              </div>
              <h3 className="text-xl font-black uppercase mb-4">Drip Campaigns</h3>
              <p className="font-['Courier_Prime'] font-bold text-sm text-black/70">
                Visual flow builder to trigger automated multi-day marketing sequences. Follow up with leads without lifting a finger.
              </p>
            </div>
            
             <div className="border-4 border-black p-6 hover:-translate-y-2 transition-transform bg-white shadow-[8px_8px_0_0_#000]">
              <div className="w-12 h-12 bg-black flex items-center justify-center mb-6">
                <MessageSquare size={24} className="text-white" />
              </div>
              <h3 className="text-xl font-black uppercase mb-4">Handoff Intelligence</h3>
              <p className="font-['Courier_Prime'] font-bold text-sm text-black/70">
                When AI pauses, humans take over. Flought instantly generates AI-handoff summaries so agents know exactly what to do.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 bg-[#C1440E] text-white border-t-4 border-black relative overflow-hidden">
         <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-black opacity-10 rotate-45 border-[32px] border-white"></div>
         <div className="absolute -top-32 -right-32 w-96 h-96 border-[32px] border-black opacity-20 rounded-full"></div>
         
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <div className="bg-white text-black border-4 border-black p-12 shadow-[16px_16px_0_0_#000] inline-block">
            <h2 className="text-5xl md:text-7xl font-black uppercase mb-6 leading-none">
              Deploy <br/> Today.
            </h2>
            <p className="text-xl font-['Courier_Prime'] font-bold text-black/70 mb-12 uppercase">
              Setup takes 5 minutes. ROI is immediate.
            </p>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95, y: 4, x: 4 }} className="inline-block">
              <Link to="/signup" className="px-12 py-6 bg-black text-white font-black text-xl uppercase border-4 border-black flex items-center justify-center gap-4 hover:bg-[#C1440E] transition-colors shadow-[8px_8px_0_0_#C1440E]">
                Execute Trial
              </Link>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
