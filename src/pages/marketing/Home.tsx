import React, { useEffect, useRef } from 'react';
import { ArrowRight, Bot, Zap, ShieldCheck, Database, MessageSquare, ArrowUpRight, ShoppingCart, Activity, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import anime from 'animejs';
import HeroPipeline from '../../components/3d/HeroPipeline';

const TiltCard = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const rotateX = useTransform(y, [-0.5, 0.5], ["5deg", "-5deg"]);
  const rotateY = useTransform(x, [-0.5, 0.5], ["-5deg", "5deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / rect.width - 0.5);
    y.set(mouseY / rect.height - 0.5);
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
      <div style={{ transform: "translateZ(20px)" }} className="h-full">
        {children}
      </div>
    </motion.div>
  );
};

const HeroSection = () => {
  const gridRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (gridRef.current) {
      anime({
        targets: '.hero-grid-dot',
        scale: [
          {value: .1, easing: 'easeOutSine', duration: 500},
          {value: 1, easing: 'easeInOutQuad', duration: 1200}
        ],
        delay: anime.stagger(200, {grid: [20, 10], from: 'center'}),
        loop: true,
        direction: 'alternate'
      });
    }

    if (textRef.current) {
      anime.timeline({loop: false})
      .add({
        targets: '.hero-word',
        translateY: [40, 0],
        translateZ: 0,
        opacity: [0, 1],
        easing: "easeOutExpo",
        duration: 1400,
        delay: (el, i) => 200 + 100 * i
      })
      .add({
        targets: '.hero-subtext',
        translateY: [20, 0],
        opacity: [0, 1],
        easing: "easeOutExpo",
        duration: 1400,
      }, '-=1000')
      .add({
        targets: '.hero-btn',
        translateY: [20, 0],
        opacity: [0, 1],
        easing: "easeOutExpo",
        duration: 1400,
        delay: anime.stagger(150)
      });
    }
  }, []);

  const rows = 10;
  const cols = 20;
  const dots = [];
  for (let i = 0; i < rows * cols; i++) {
    dots.push(<div key={i} className="hero-grid-dot w-1.5 h-1.5 rounded-full bg-[#002E23]/20" />);
  }

  return (
    <section className="relative pt-32 pb-40 overflow-hidden bg-white border-b border-[#EAEAEA]">
      <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden opacity-40 pointer-events-none">
        <div ref={gridRef} className="grid gap-8" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {dots}
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_20%,_#ffffff_70%)]"></div>
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          
          <div className="text-left">
            <div className="hero-subtext opacity-0 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#002E23]/5 text-[#002E23] font-semibold text-sm mb-8 border border-[#002E23]/10">
              <span className="w-2 h-2 rounded-full bg-[#002E23] animate-pulse"></span>
              Flought OS v2.0
            </div>
            
            <h1 ref={textRef} className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-[#00221A] mb-8 leading-tight">
              <span className="hero-word inline-block opacity-0">Put</span>{' '}
              <span className="hero-word inline-block opacity-0">your</span>{' '}<br className="hidden md:block" />
              <span className="hero-word inline-block opacity-0 text-[#002E23]">WhatsApp</span><br />
              <span className="hero-word inline-block opacity-0">on</span>{' '}
              <span className="hero-word inline-block opacity-0">autopilot.</span>
            </h1>
            
            <p className="hero-subtext opacity-0 text-xl text-[#4A6B5D] max-w-xl mb-12 font-medium leading-relaxed">
              Not a generic chatbot. A complete WhatsApp OS with native <strong className="text-[#002E23] font-semibold">Shopify & CRM sync</strong>, automated <strong className="text-[#002E23] font-semibold">Drip Campaigns</strong>, and strict <strong className="text-[#002E23] font-semibold">pgvector RAG</strong> to resolve 80% of support queries instantly.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-start gap-6">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto">
                <Link to="/signup" className="hero-btn opacity-0 flex items-center gap-3 bg-[#002E23] text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-[#00392C] transition-colors shadow-md justify-center">
                  Start Trial <ArrowRight size={20} />
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto">
                <Link to="/features" className="hero-btn opacity-0 flex items-center gap-3 bg-[#FAFAFA] text-[#002E23] px-8 py-4 rounded-xl text-lg font-semibold border border-[#EAEAEA] hover:border-[#002E23]/20 hover:bg-white transition-colors shadow-sm justify-center">
                  View Specs
                </Link>
              </motion.div>
            </div>
          </div>

          <div className="hero-3d relative lg:h-[700px] flex items-center justify-center z-50">
            <HeroPipeline queryVolume={1000} percentSolved={0.8} />
          </div>

        </div>
      </div>
    </section>
  );
};

const Home: React.FC = () => {
  return (
    <div className="flex flex-col w-full bg-[#FAFAFA] text-[#00221A]">
      <HeroSection />

      {/* Logos Section */}
      <section className="py-12 border-b border-[#EAEAEA] bg-[#FAFAFA] overflow-hidden">
        <div className="flex whitespace-nowrap animate-[scroll_40s_linear_infinite] items-center gap-24 font-semibold text-sm text-[#4A6B5D] uppercase tracking-wider">
          {Array(8).fill(0).map((_, i) => (
            <React.Fragment key={i}>
              <span className="flex items-center gap-2"><div className="w-3 h-3 bg-[#002E23] rounded-sm"></div> ACME CORP</span>
              <span className="flex items-center gap-2"><div className="w-3 h-3 border-2 border-[#002E23] rounded-full"></div> GLOBEX</span>
              <span className="flex items-center gap-2"><div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent border-b-[#002E23]"></div> INITECH</span>
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* The Problem / Solution Grid */}
      <section className="py-32 bg-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-6xl font-bold text-[#00221A] tracking-tight mb-6">
              The status quo is broken.
            </h2>
            <p className="text-[#4A6B5D] text-xl max-w-2xl mx-auto">See how Flought fundamentally changes the way you operate.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 md:gap-12">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <TiltCard>
                <div className="bg-[#FAFAFA] rounded-3xl p-10 border border-[#EAEAEA] h-full flex flex-col shadow-sm">
                  <div className="w-12 h-12 bg-white text-[#4A6B5D] rounded-2xl flex items-center justify-center mb-8 border border-[#EAEAEA] shadow-sm">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </div>
                  <h3 className="text-2xl font-bold mb-8 text-[#00221A]">Legacy Operations</h3>
                  <ul className="space-y-6 text-lg text-[#4A6B5D]">
                    <li className="flex items-start gap-4"><span className="text-[#4A6B5D] mt-1">•</span>Sales leads go cold while waiting for human replies.</li>
                    <li className="flex items-start gap-4"><span className="text-[#4A6B5D] mt-1">•</span>Agents repeat the same basic answers manually.</li>
                    <li className="flex items-start gap-4"><span className="text-[#4A6B5D] mt-1">•</span>Zero visibility into what customers are actually asking.</li>
                    <li className="flex items-start gap-4"><span className="text-[#4A6B5D] mt-1">•</span>Scaling volume requires blindly hiring more heads.</li>
                  </ul>
                </div>
              </TiltCard>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <TiltCard>
                <div className="bg-[#002E23] rounded-3xl p-10 h-full flex flex-col shadow-xl shadow-[#00221A]/10 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-[#00392C] text-white font-bold text-xs uppercase tracking-wider px-4 py-1.5 rounded-bl-xl">The Flought Way</div>
                  <motion.div 
                    animate={{ rotate: [0, 10, -10, 0] }} 
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                    className="w-12 h-12 bg-white text-[#002E23] rounded-2xl flex items-center justify-center mb-8 shadow-md"
                  >
                    <ShieldCheck size={24} />
                  </motion.div>
                  <h3 className="text-2xl font-bold mb-8">Autonomous Scale</h3>
                  <ul className="space-y-6 text-lg text-[#F8F9FA]">
                    <li className="flex items-start gap-4"><span className="text-white mt-1">•</span>Instant, strict RAG answers block 80% of volume.</li>
                    <li className="flex items-start gap-4"><span className="text-white mt-1">•</span>Automated drip campaigns re-engage dead leads.</li>
                    <li className="flex items-start gap-4"><span className="text-white mt-1">•</span>Native Shopify sync handles order tracking automatically.</li>
                    <li className="flex items-start gap-4"><span className="text-white mt-1">•</span>Human agents only step in for high-value closures.</li>
                  </ul>
                </div>
              </TiltCard>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="py-32 bg-[#FAFAFA] border-y border-[#EAEAEA] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-[#00221A] tracking-tight mb-4">
              Everything you need to scale.
            </h2>
            <p className="text-[#4A6B5D] text-xl">A complete OS designed for modern commerce.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.1 }}
              whileHover={{ y: -5, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)" }} 
              className="bg-white p-8 rounded-3xl border border-[#EAEAEA] transition-all"
            >
              <div className="w-14 h-14 bg-[#FAFAFA] rounded-xl flex items-center justify-center mb-6 text-[#002E23] border border-[#EAEAEA]">
                <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}>
                  <Database size={24} />
                </motion.div>
              </div>
              <h3 className="text-2xl font-bold text-[#00221A] mb-4">Vector RAG</h3>
              <p className="text-[#4A6B5D] leading-relaxed">
                We use pgvector to embed your PDFs and knowledge base. The AI strictly answers based on your context, eliminating hallucinations.
              </p>
            </motion.div>
            
            {/* Feature 2 */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.2 }}
              whileHover={{ y: -5, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)" }} 
              className="bg-white p-8 rounded-3xl border border-[#EAEAEA] transition-all"
            >
              <div className="w-14 h-14 bg-[#FAFAFA] rounded-xl flex items-center justify-center mb-6 text-[#002E23] border border-[#EAEAEA]">
                <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}>
                  <Activity size={24} />
                </motion.div>
              </div>
              <h3 className="text-2xl font-bold text-[#00221A] mb-4">Drip Campaigns</h3>
              <p className="text-[#4A6B5D] leading-relaxed">
                Build sophisticated WhatsApp sequences to nurture leads, recover abandoned carts, and re-engage dormant users over time.
              </p>
            </motion.div>
            
            {/* Feature 3 */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.3 }}
              whileHover={{ y: -5, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)" }} 
              className="bg-white p-8 rounded-3xl border border-[#EAEAEA] transition-all"
            >
              <div className="w-14 h-14 bg-[#FAFAFA] rounded-xl flex items-center justify-center mb-6 text-[#002E23] border border-[#EAEAEA]">
                <motion.div animate={{ x: [0, 3, 0] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}>
                  <ShoppingCart size={24} />
                </motion.div>
              </div>
              <h3 className="text-2xl font-bold text-[#00221A] mb-4">Commerce Sync</h3>
              <p className="text-[#4A6B5D] leading-relaxed">
                Natively connected to Shopify. Customers can check order status, browse catalogs, and get support entirely within WhatsApp.
              </p>
            </motion.div>

            {/* Feature 4 */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.4 }}
              whileHover={{ y: -5, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)" }} 
              className="bg-white p-8 rounded-3xl border border-[#EAEAEA] transition-all"
            >
              <div className="w-14 h-14 bg-[#FAFAFA] rounded-xl flex items-center justify-center mb-6 text-[#002E23] border border-[#EAEAEA]">
                <motion.div animate={{ rotate: [0, -10, 10, 0] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}>
                  <MessageSquare size={24} />
                </motion.div>
              </div>
              <h3 className="text-2xl font-bold text-[#00221A] mb-4">Unified Inbox</h3>
              <p className="text-[#4A6B5D] leading-relaxed">
                When the AI can't answer, it escalates smoothly. Human agents step into a shared inbox with full chat history and context.
              </p>
            </motion.div>

            {/* Feature 5 */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.5 }}
              whileHover={{ y: -5, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)" }} 
              className="bg-white p-8 rounded-3xl border border-[#EAEAEA] transition-all"
            >
              <div className="w-14 h-14 bg-[#FAFAFA] rounded-xl flex items-center justify-center mb-6 text-[#002E23] border border-[#EAEAEA]">
                <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}>
                  <Users size={24} />
                </motion.div>
              </div>
              <h3 className="text-2xl font-bold text-[#00221A] mb-4">Custom Personas</h3>
              <p className="text-[#4A6B5D] leading-relaxed">
                Train your AI to sound exactly like your brand. From formal corporate to friendly and casual, the AI adapts perfectly.
              </p>
            </motion.div>

            {/* Feature 6 */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.6 }}
              whileHover={{ y: -5, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)" }} 
              className="bg-white p-8 rounded-3xl border border-[#EAEAEA] transition-all"
            >
              <div className="w-14 h-14 bg-[#FAFAFA] rounded-xl flex items-center justify-center mb-6 text-[#002E23] border border-[#EAEAEA]">
                <motion.div animate={{ rotate: [0, 360] }} transition={{ repeat: Infinity, duration: 10, ease: "linear" }}>
                  <Bot size={24} />
                </motion.div>
              </div>
              <h3 className="text-2xl font-bold text-[#00221A] mb-4">Real-time Analytics</h3>
              <p className="text-[#4A6B5D] leading-relaxed">
                Live dashboard tracking deflection rates, sentiment analysis, and agent performance across all your WhatsApp numbers.
              </p>
            </motion.div>

          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 bg-white text-center overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-4xl mx-auto px-6"
        >
          <h2 className="text-4xl md:text-6xl font-bold text-[#00221A] mb-8 tracking-tight">
            Stop losing customers to slow replies.
          </h2>
          <p className="text-xl text-[#4A6B5D] mb-12">
            Join the forward-thinking brands running their operations on Flought.
          </p>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="inline-block">
            <Link to="/signup" className="flex items-center gap-3 bg-[#002E23] text-white px-10 py-5 rounded-2xl text-xl font-bold hover:bg-[#00392C] transition-colors shadow-lg shadow-[#00221A]/10">
              Start Free Trial <ArrowUpRight size={24} />
            </Link>
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
};

export default Home;
