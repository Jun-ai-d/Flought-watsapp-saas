import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { ArrowRight, Bot, Zap, ShieldCheck, Database, MessageSquare, ArrowUpRight, ShoppingCart, Activity, Users, ChevronDown, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import anime from 'animejs';

const HeroPipeline = lazy(() => import('../../../components/3d/HeroPipeline'));

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
        loop: false,
        direction: 'normal'
      });
    }

    if (textRef.current) {
      // Note: H1 (.hero-title) is intentionally excluded from this animation 
      // so it renders immediately at full opacity for LCP.
      anime.timeline({loop: false})
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
    <section className="relative pt-16 pb-20 overflow-hidden bg-white border-b border-[#EAEAEA]">
      <Helmet>
        <title>Flought | Automate Your WhatsApp Business</title>
        <meta name="description" content="Put your WhatsApp on autopilot. A complete WhatsApp OS with native Shopify & CRM sync, automated Drip Campaigns, and strict pgvector RAG." />
        <link rel="canonical" href="https://flought.com/" />
        <script type="application/ld+json">
          {`
            {
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://flought.com/#organization",
                  "name": "Flought",
                  "url": "https://flought.com",
                  "logo": "https://flought.com/favicon.svg",
                  "description": "Flought provides an automated WhatsApp OS for commerce and CRM syncing."
                },
                {
                  "@type": "SoftwareApplication",
                  "name": "Flought OS",
                  "applicationCategory": "BusinessApplication",
                  "operatingSystem": "Web",
                  "offers": {
                    "@type": "Offer",
                    "price": "0",
                    "priceCurrency": "USD"
                  },
                  "aggregateRating": {
                    "@type": "AggregateRating",
                    "ratingValue": "4.9",
                    "ratingCount": "150"
                  }
                }
              ]
            }
          `}
        </script>
      </Helmet>

      <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden opacity-40 pointer-events-none">
        <div ref={gridRef} className="grid gap-8" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {dots}
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_20%,_#ffffff_70%)]"></div>
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="flex flex-col gap-10 items-center">
          
          <div className="text-left">
            <div className="hero-subtext opacity-0 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#002E23]/5 text-[#002E23] font-semibold text-sm mb-8 border border-[#002E23]/10">
              <span className="w-2 h-2 rounded-full bg-[#002E23] animate-pulse"></span>
              Flought OS v2.0
            </div>
            
            <h1 ref={textRef} className="text-4xl sm:text-5xl font-bold tracking-tight text-[#00221A] leading-[1.1] mb-6">
              Put your WhatsApp <br/>
              on <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#002E23] to-[#4A6B5D]">autopilot.</span>
            </h1>
            
            <p className="hero-subtext opacity-0 text-base sm:text-lg text-[#4A6B5D] max-w-xl mb-10 font-medium leading-relaxed">
              Not a generic chatbot. A complete WhatsApp OS with native <strong className="text-[#002E23] font-semibold">Shopify & CRM sync</strong>, <strong className="text-[#002E23] font-semibold">Self-Learning RAG</strong>, and <strong className="text-[#002E23] font-semibold">Zero-Latency Caching</strong> to resolve 80% of support queries instantly.
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

          <div className="hero-3d relative h-[350px] sm:h-[450px] w-full flex items-center justify-center z-50 mt-4 sm:mt-8">
            <Suspense fallback={<div className="w-full h-full min-h-[350px]" />}>
              <HeroPipeline queryVolume={1000} percentSolved={0.8} />
            </Suspense>
          </div>

        </div>
      </div>
    </section>
  );
};

const FAQItem = ({ question, answer }: { question: string, answer: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-[#EAEAEA]">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full py-6 flex items-center justify-between text-left focus:outline-none"
      >
        <span className="text-xl font-bold text-[#00221A]">{question}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
          <ChevronDown className="text-[#4A6B5D]" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-[#4A6B5D] text-lg leading-relaxed">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MobileHome: React.FC = () => {
  return (
    <div className="flex flex-col w-full bg-[#FAFAFA] text-[#00221A]">
      <HeroSection />

      {/* ROI / Stats Highlight */}
      <section className="py-20 bg-[#002E23] text-white overflow-hidden relative">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid md:grid-cols-3 gap-12 text-center divide-y md:divide-y-0 md:divide-x divide-white/20">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="pt-8 md:pt-0">
              <div className="text-5xl font-display font-bold mb-2">80%</div>
              <div className="text-[#A7C7B9] text-lg">Queries Resolved Instantly</div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="pt-8 md:pt-0">
              <div className="text-5xl font-display font-bold mb-2">24/7</div>
              <div className="text-[#A7C7B9] text-lg">Always-on Support</div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="pt-8 md:pt-0">
              <div className="text-5xl font-display font-bold mb-2">&lt; 1s</div>
              <div className="text-[#A7C7B9] text-lg">Average Response Time</div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-32 bg-white border-b border-[#EAEAEA] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-24"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-[#00221A] tracking-tight mb-4">
              Go live in minutes, not months.
            </h2>
            <p className="text-[#4A6B5D] text-xl">The simplest path to enterprise-grade WhatsApp automation.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-12 relative">
            {/* Connecting Line (Desktop only) */}
            <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-transparent via-[#EAEAEA] to-transparent z-0"></div>

            {/* Step 1 */}
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="relative z-10 text-center flex flex-col items-center">
              <div className="w-24 h-24 bg-[#FAFAFA] rounded-full border-4 border-white shadow-xl flex items-center justify-center text-2xl font-bold text-[#002E23] mb-8 relative">
                1
                <div className="absolute -bottom-2 right-0 bg-[#059669] text-white p-1.5 rounded-full shadow-sm"><Zap size={16} /></div>
              </div>
              <h3 className="text-2xl font-bold text-[#00221A] mb-4">Connect WhatsApp</h3>
              <p className="text-[#4A6B5D] text-lg leading-relaxed">Securely link your WhatsApp Business API with a few clicks. No coding required.</p>
            </motion.div>

            {/* Step 2 */}
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="relative z-10 text-center flex flex-col items-center">
              <div className="w-24 h-24 bg-[#002E23] rounded-full border-4 border-white shadow-xl flex items-center justify-center text-2xl font-bold text-white mb-8 relative">
                2
                <div className="absolute -bottom-2 right-0 bg-[#C1440E] text-white p-1.5 rounded-full shadow-sm"><Database size={16} /></div>
              </div>
              <h3 className="text-2xl font-bold text-[#00221A] mb-4">Upload Knowledge</h3>
              <p className="text-[#4A6B5D] text-lg leading-relaxed">Drag and drop PDFs, URLs, and FAQs. Our pgvector engine instantly embeds your business logic.</p>
            </motion.div>

            {/* Step 3 */}
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4 }} className="relative z-10 text-center flex flex-col items-center">
              <div className="w-24 h-24 bg-[#FAFAFA] rounded-full border-4 border-white shadow-xl flex items-center justify-center text-2xl font-bold text-[#002E23] mb-8 relative">
                3
                <div className="absolute -bottom-2 right-0 bg-[#059669] text-white p-1.5 rounded-full shadow-sm"><Bot size={16} /></div>
              </div>
              <h3 className="text-2xl font-bold text-[#00221A] mb-4">Go on Autopilot</h3>
              <p className="text-[#4A6B5D] text-lg leading-relaxed">Turn on the AI. It immediately begins resolving 80% of support queries autonomously.</p>
            </motion.div>
          </div>
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
                    <li className="flex items-start gap-4"><span className="text-white mt-1">•</span>Instant, Hybrid RAG answers block 80% of volume.</li>
                    <li className="flex items-start gap-4"><span className="text-white mt-1">•</span>Semantic Caching reduces LLM token costs to zero.</li>
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
            
            {/* Feature 2: Agent Router */}
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
              <h3 className="text-2xl font-bold text-[#00221A] mb-4">Adaptive Routing</h3>
              <p className="text-[#4A6B5D] leading-relaxed">
                An ultra-fast LLM classifies user intent. If a user asks "Cancel my order AND what are your hours?", it splits and handles both simultaneously.
              </p>
            </motion.div>

            {/* Feature 3: Semantic Caching */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.3 }}
              whileHover={{ y: -5, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)" }} 
              className="bg-white p-8 rounded-3xl border border-[#EAEAEA] transition-all"
            >
              <div className="w-14 h-14 bg-[#FAFAFA] rounded-xl flex items-center justify-center mb-6 text-[#002E23] border border-[#EAEAEA]">
                <motion.div animate={{ rotate: [0, 360] }} transition={{ repeat: Infinity, duration: 10, ease: "linear" }}>
                  <Zap size={24} />
                </motion.div>
              </div>
              <h3 className="text-2xl font-bold text-[#00221A] mb-4">Zero-Latency Caching</h3>
              <p className="text-[#4A6B5D] leading-relaxed">
                We safely cache AI responses globally. If multiple users ask similar questions across different languages, they get instant answers with zero LLM cost.
              </p>
            </motion.div>

            {/* Feature 4: Auto-FAQ Miner */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.4 }}
              whileHover={{ y: -5, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)" }} 
              className="bg-white p-8 rounded-3xl border border-[#EAEAEA] transition-all"
            >
              <div className="w-14 h-14 bg-[#FAFAFA] rounded-xl flex items-center justify-center mb-6 text-[#002E23] border border-[#EAEAEA]">
                <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}>
                  <Bot size={24} />
                </motion.div>
              </div>
              <h3 className="text-2xl font-bold text-[#00221A] mb-4">Self-Learning Miner</h3>
              <p className="text-[#4A6B5D] leading-relaxed">
                A nightly engine analyzes your chat logs to find high-frequency questions, automatically generating draft FAQs to continually smarten your bot.
              </p>
            </motion.div>

            {/* Feature 5: Hybrid Search */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.5 }}
              whileHover={{ y: -5, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)" }} 
              className="bg-white p-8 rounded-3xl border border-[#EAEAEA] transition-all"
            >
              <div className="w-14 h-14 bg-[#FAFAFA] rounded-xl flex items-center justify-center mb-6 text-[#002E23] border border-[#EAEAEA]">
                <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}>
                  <Database size={24} />
                </motion.div>
              </div>
              <h3 className="text-2xl font-bold text-[#00221A] mb-4">Hybrid Search (RRF)</h3>
              <p className="text-[#4A6B5D] leading-relaxed">
                Combines pgvector semantic understanding with BM25 exact keyword matching, ensuring product SKUs and Order IDs are never missed.
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

      {/* Deep-Dive Value Propositions (Zig-Zag) */}
      <section className="py-32 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 space-y-32">
          
          {/* Row 1 */}
          <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
            <motion.div initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="w-full md:w-1/2">
              <div className="aspect-square rounded-3xl bg-[#FAFAFA] border border-[#EAEAEA] shadow-inner p-8 flex items-center justify-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#002E23]/5 to-transparent"></div>
                {/* Mock UI Element */}
                <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm border border-gray-100 z-10 transform group-hover:scale-105 transition-transform duration-500">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-2xl">🤖</div>
                    <div>
                      <div className="font-bold text-gray-900">Flought AI</div>
                      <div className="text-sm text-emerald-600 font-medium">Resolving instantly</div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-gray-100 p-3 rounded-2xl rounded-tl-sm text-gray-700 text-sm w-[85%]">Hey! How can I help you today?</div>
                    <div className="bg-[#002E23] text-white p-3 rounded-2xl rounded-tr-sm text-sm w-[85%] ml-auto">Where is my order #1234?</div>
                    <div className="bg-gray-100 p-3 rounded-2xl rounded-tl-sm text-gray-700 text-sm w-[85%]">Your order is currently out for delivery and should arrive by 4:00 PM today! 🚚</div>
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="w-full md:w-1/2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#059669]/10 text-[#059669] font-semibold text-sm mb-6">
                <ShieldCheck size={16} /> Zero-Downtime Support
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-[#00221A] tracking-tight mb-6">
                Your customers don't sleep. Neither should you.
              </h2>
              <p className="text-[#4A6B5D] text-lg leading-relaxed mb-8">
                Provide instant, accurate responses 24/7/365. By resolving routine queries automatically, you ensure that your customers always feel heard, drastically reducing churn and increasing lifetime value.
              </p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-lg font-medium text-[#00221A]"><CheckCircle2 className="text-[#059669]" /> Multilingual support built-in</li>
                <li className="flex items-center gap-3 text-lg font-medium text-[#00221A]"><CheckCircle2 className="text-[#059669]" /> Strict RAG guarantees no hallucinations</li>
                <li className="flex items-center gap-3 text-lg font-medium text-[#00221A]"><CheckCircle2 className="text-[#059669]" /> Seamless Shopify integration</li>
              </ul>
            </motion.div>
          </div>

          {/* Row 2 */}
          <div className="flex flex-col md:flex-row-reverse items-center gap-10 md:gap-16">
            <motion.div initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="w-full md:w-1/2">
              <div className="aspect-square rounded-3xl bg-[#002E23] p-8 flex flex-col justify-center relative overflow-hidden group shadow-2xl shadow-[#002E23]/20">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                {/* Mock UI Element */}
                <div className="bg-[#00392C] p-6 rounded-2xl shadow-xl w-full max-w-sm mx-auto border border-white/10 z-10 transform group-hover:-translate-y-2 transition-transform duration-500">
                  <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-xl shadow-lg shadow-amber-500/20">👩‍💼</div>
                      <div className="text-white font-bold">Sarah (Agent)</div>
                    </div>
                    <div className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded font-bold uppercase tracking-wider">High Priority</div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-white/60 text-xs uppercase tracking-wider font-bold">Internal Note</div>
                    <div className="text-white text-sm bg-black/20 p-4 rounded-xl italic">
                      "AI flagged this conversation: Customer is requesting a complex refund for a damaged item. Handoff initiated."
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="w-full md:w-1/2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C1440E]/10 text-[#C1440E] font-semibold text-sm mb-6">
                <Users size={16} /> Seamless Human Handoff
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-[#00221A] tracking-tight mb-6">
                AI when you can. Human when you must.
              </h2>
              <p className="text-[#4A6B5D] text-lg leading-relaxed mb-8">
                Not everything can be automated. When the AI detects frustration, low confidence, or specific keywords, it instantly alerts your human agents and passes the entire conversation context to the Shared Inbox.
              </p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-lg font-medium text-[#00221A]"><CheckCircle2 className="text-[#059669]" /> Sentiment analysis routing</li>
                <li className="flex items-center gap-3 text-lg font-medium text-[#00221A]"><CheckCircle2 className="text-[#059669]" /> Full context preservation</li>
                <li className="flex items-center gap-3 text-lg font-medium text-[#00221A]"><CheckCircle2 className="text-[#059669]" /> Real-time team collaboration</li>
              </ul>
            </motion.div>
          </div>

        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-32 bg-[#FAFAFA] border-t border-[#EAEAEA]">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-[#00221A] tracking-tight mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-[#4A6B5D] text-xl">Everything you need to know about scaling with Flought.</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-3xl border border-[#EAEAEA] p-8 md:p-12 shadow-sm"
          >
            <FAQItem 
              question="Do I need my own WhatsApp Business API account?" 
              answer="Yes, you will need to link your own WhatsApp Business API account. The process is seamless and we guide you through connecting it directly via the Meta dashboard within our platform." 
            />
            <FAQItem 
              question="How does the AI know what to say?" 
              answer="You simply upload your existing knowledge base (PDFs, Notion docs, FAQs, or website URLs). Our advanced Vector RAG engine analyzes your documents and restricts the AI to strictly answer using only the provided context. It will never invent answers." 
            />
            <FAQItem 
              question="Can I take over an AI conversation manually?" 
              answer="Absolutely. Our Unified Inbox allows human agents to monitor all ongoing AI conversations in real-time. With one click, an agent can pause the AI and take over the chat to provide a personal touch." 
            />
            <FAQItem 
              question="Is my customer data secure?" 
              answer="Security is our top priority. Our infrastructure utilizes strict Row Level Security (RLS) ensuring absolute tenant isolation—meaning no other business can ever access your data. We are fully compliant with GDPR and Meta's developer terms." 
            />
          </motion.div>
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

export default MobileHome;
