import React from 'react';
import { Check, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Helmet } from 'react-helmet-async';

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

const Pricing: React.FC = () => {
  return (
    <div className="w-full bg-[#FAFAFA] pb-32 font-sans text-[#00221A]">
      <Helmet>
        <title>Flought Pricing | Affordable WhatsApp SaaS</title>
        <meta name="description" content="Start for free, upgrade when you hit scale. No hidden fees. Transparent pricing for the ultimate WhatsApp Automation OS." />
        <link rel="canonical" href="https://flought.com/pricing" />
      </Helmet>

      {/* Header */}
      <section className="pt-32 pb-20 text-center px-6 relative bg-white border-b border-[#EAEAEA]">
        <div className="relative z-10">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
            Transparent Pricing
          </h1>
          <p className="text-xl md:text-2xl text-[#4A6B5D] max-w-2xl mx-auto font-medium">
            Start for free, upgrade when you hit scale. No hidden fees.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="max-w-6xl mx-auto px-6 mt-20 mb-32 relative z-10">
        <div className="grid md:grid-cols-3 gap-8 items-stretch">
          
          {/* Free Tier */}
          <TiltCard>
            <div className="bg-white rounded-3xl p-10 shadow-sm border border-[#EAEAEA] h-full flex flex-col">
              <h2 className="text-3xl font-bold mb-2">Free</h2>
              <p className="text-sm font-medium text-[#4A6B5D] mb-8 h-10">
                Perfect for testing the waters.
              </p>
              <div className="mb-10">
                <span className="text-6xl font-bold tracking-tight">$0</span>
                <span className="text-lg font-semibold text-[#4A6B5D] ml-2">/mo</span>
              </div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link to="/signup" className="block w-full py-4 text-center font-semibold rounded-2xl border border-[#EAEAEA] text-[#00221A] bg-[#FAFAFA] hover:border-[#002E23] hover:text-[#002E23] transition-all mb-10">
                  Start for Free
                </Link>
              </motion.div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-[#4A6B5D] mb-6">What's Included</p>
                <ul className="space-y-5 font-medium text-[#00221A]">
                  <li className="flex items-center gap-4"><div className="w-6 h-6 rounded-full bg-[#FAFAFA] flex items-center justify-center border border-[#EAEAEA]"><Check size={14} className="text-[#002E23]" /></div> 100 Utility Messages / mo</li>
                  <li className="flex items-center gap-4"><div className="w-6 h-6 rounded-full bg-[#FAFAFA] flex items-center justify-center border border-[#EAEAEA]"><Check size={14} className="text-[#002E23]" /></div> 50 AI Queries / mo</li>
                  <li className="flex items-center gap-4"><div className="w-6 h-6 rounded-full bg-[#FAFAFA] flex items-center justify-center border border-[#EAEAEA]"><Check size={14} className="text-[#002E23]" /></div> 1 Human Agent</li>
                  <li className="flex items-center gap-4"><div className="w-6 h-6 rounded-full bg-[#FAFAFA] flex items-center justify-center border border-[#EAEAEA]"><Check size={14} className="text-[#002E23]" /></div> Basic RAG (1 PDF limit)</li>
                </ul>
              </div>
            </div>
          </TiltCard>

          {/* Starter Tier */}
          <TiltCard className="md:-mt-8 md:mb-8 relative z-20">
            <div className="bg-[#002E23] text-white rounded-3xl p-10 shadow-xl shadow-[#00221A]/10 h-full flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-white text-[#002E23] font-bold text-xs px-4 py-1.5 rounded-bl-xl uppercase tracking-wider">
                Most Popular
              </div>
              
              <h2 className="text-3xl font-bold mb-2 relative z-10">Starter</h2>
              <p className="text-sm font-medium text-white/70 mb-8 h-10 relative z-10">
                For automating your initial support load.
              </p>
              <div className="mb-10 relative z-10">
                <span className="text-6xl font-bold tracking-tight">$49</span>
                <span className="text-lg font-semibold text-white/70 ml-2">/mo</span>
              </div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="relative z-10">
                <Link to="/signup" className="block w-full py-4 text-center font-bold rounded-2xl bg-white text-[#002E23] hover:bg-[#FAFAFA] transition-all mb-10 shadow-md">
                  Get Started
                </Link>
              </motion.div>
              <div className="flex-1 relative z-10">
                <p className="text-xs font-bold uppercase tracking-wider text-white mb-6 opacity-90">Everything in Free, plus</p>
                <ul className="space-y-5 font-medium text-white">
                  <li className="flex items-center gap-4"><div className="w-6 h-6 rounded-full bg-white flex items-center justify-center"><Check size={14} className="text-[#002E23]" /></div> 2,000 Utility Messages / mo</li>
                  <li className="flex items-center gap-4"><div className="w-6 h-6 rounded-full bg-white flex items-center justify-center"><Check size={14} className="text-[#002E23]" /></div> 1,000 AI Queries / mo</li>
                  <li className="flex items-center gap-4"><div className="w-6 h-6 rounded-full bg-white flex items-center justify-center"><Check size={14} className="text-[#002E23]" /></div> 3 Human Agents</li>
                  <li className="flex items-center gap-4"><div className="w-6 h-6 rounded-full bg-white flex items-center justify-center"><Check size={14} className="text-[#002E23]" /></div> Flow Builder Access</li>
                  <li className="flex items-center gap-4"><div className="w-6 h-6 rounded-full bg-white flex items-center justify-center"><Check size={14} className="text-[#002E23]" /></div> Up to 10 PDFs (Knowledge)</li>
                </ul>
              </div>
            </div>
          </TiltCard>

          {/* Pro Tier */}
          <TiltCard>
            <div className="bg-white rounded-3xl p-10 shadow-sm border border-[#EAEAEA] h-full flex flex-col">
              <h2 className="text-3xl font-bold mb-2">Pro</h2>
              <p className="text-sm font-medium text-[#4A6B5D] mb-8 h-10">
                For scaling operations needing API access.
              </p>
              <div className="mb-10">
                <span className="text-6xl font-bold tracking-tight">$149</span>
                <span className="text-lg font-semibold text-[#4A6B5D] ml-2">/mo</span>
              </div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link to="/signup" className="block w-full py-4 text-center font-semibold rounded-2xl border border-[#EAEAEA] text-[#00221A] bg-[#FAFAFA] hover:border-[#002E23] hover:text-[#002E23] transition-all mb-10">
                  Go Pro
                </Link>
              </motion.div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-[#4A6B5D] mb-6">Everything in Starter, plus</p>
                <ul className="space-y-5 font-medium text-[#00221A]">
                  <li className="flex items-center gap-4"><div className="w-6 h-6 rounded-full bg-[#FAFAFA] flex items-center justify-center border border-[#EAEAEA]"><Check size={14} className="text-[#002E23]" /></div> 10,000 Utility Messages / mo</li>
                  <li className="flex items-center gap-4"><div className="w-6 h-6 rounded-full bg-[#FAFAFA] flex items-center justify-center border border-[#EAEAEA]"><Check size={14} className="text-[#002E23]" /></div> Unlimited AI Queries</li>
                  <li className="flex items-center gap-4"><div className="w-6 h-6 rounded-full bg-[#FAFAFA] flex items-center justify-center border border-[#EAEAEA]"><Check size={14} className="text-[#002E23]" /></div> Unlimited Agents</li>
                  <li className="flex items-center gap-4"><div className="w-6 h-6 rounded-full bg-[#FAFAFA] flex items-center justify-center border border-[#EAEAEA]"><Check size={14} className="text-[#002E23]" /></div> Unlimited Knowledge Docs</li>
                  <li className="flex items-center gap-4"><div className="w-6 h-6 rounded-full bg-[#FAFAFA] flex items-center justify-center border border-[#EAEAEA]"><Check size={14} className="text-[#002E23]" /></div> Developer API Access</li>
                </ul>
              </div>
            </div>
          </TiltCard>

        </div>
      </section>

      {/* Comparison Table */}
      <section className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold tracking-tight mb-4">Compare Plans in Detail</h2>
          <p className="text-[#4A6B5D] font-medium">Find the perfect tier for your team's needs.</p>
        </div>
        
        <div className="overflow-x-auto bg-white rounded-3xl border border-[#EAEAEA] shadow-sm">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-[#EAEAEA] text-sm font-bold uppercase tracking-wider text-[#4A6B5D]">
                <th className="p-8 w-1/3 font-semibold">Features</th>
                <th className="p-8 border-l border-[#EAEAEA] font-semibold text-[#00221A]">Free</th>
                <th className="p-8 border-l border-[#EAEAEA] font-semibold bg-[#002E23] text-white">Starter</th>
                <th className="p-8 border-l border-[#EAEAEA] font-semibold text-[#00221A]">Pro</th>
              </tr>
            </thead>
            <tbody className="text-[15px] font-medium">
              <tr className="border-b border-[#EAEAEA] hover:bg-[#FAFAFA] transition-colors">
                <td className="p-6 px-8 border-r border-[#EAEAEA] text-[#4A6B5D]">Price</td>
                <td className="p-6 px-8 border-r border-[#EAEAEA] text-[#00221A]">$0/mo</td>
                <td className="p-6 px-8 border-r border-[#EAEAEA] text-[#002E23] font-bold">$49/mo</td>
                <td className="p-6 px-8 text-[#00221A]">$149/mo</td>
              </tr>
              <tr className="border-b border-[#EAEAEA] bg-[#FAFAFA] hover:bg-white transition-colors">
                <td className="p-6 px-8 border-r border-[#EAEAEA] text-[#4A6B5D]">Utility Messages</td>
                <td className="p-6 px-8 border-r border-[#EAEAEA] text-[#00221A]">100</td>
                <td className="p-6 px-8 border-r border-[#EAEAEA] text-[#002E23] font-bold">2,000</td>
                <td className="p-6 px-8 text-[#00221A]">10,000</td>
              </tr>
              <tr className="border-b border-[#EAEAEA] hover:bg-[#FAFAFA] transition-colors">
                <td className="p-6 px-8 border-r border-[#EAEAEA] text-[#4A6B5D]">AI Queries</td>
                <td className="p-6 px-8 border-r border-[#EAEAEA] text-[#00221A]">50</td>
                <td className="p-6 px-8 border-r border-[#EAEAEA] text-[#002E23] font-bold">1,000</td>
                <td className="p-6 px-8 text-[#00221A]">Unlimited</td>
              </tr>
              <tr className="border-b border-[#EAEAEA] bg-[#FAFAFA] hover:bg-white transition-colors">
                <td className="p-6 px-8 border-r border-[#EAEAEA] text-[#4A6B5D]">Human Agents</td>
                <td className="p-6 px-8 border-r border-[#EAEAEA] text-[#00221A]">1</td>
                <td className="p-6 px-8 border-r border-[#EAEAEA] text-[#002E23] font-bold">3</td>
                <td className="p-6 px-8 text-[#00221A]">Unlimited</td>
              </tr>
              <tr className="border-b border-[#EAEAEA] hover:bg-[#FAFAFA] transition-colors">
                <td className="p-6 px-8 border-r border-[#EAEAEA] text-[#4A6B5D]">Knowledge Base (PDFs)</td>
                <td className="p-6 px-8 border-r border-[#EAEAEA] text-[#00221A]">1 Doc (max 2MB)</td>
                <td className="p-6 px-8 border-r border-[#EAEAEA] text-[#002E23] font-bold">10 Docs</td>
                <td className="p-6 px-8 text-[#00221A]">Unlimited</td>
              </tr>
              <tr className="bg-[#FAFAFA] hover:bg-white transition-colors">
                <td className="p-6 px-8 border-r border-[#EAEAEA] text-[#4A6B5D]">Flow Builder</td>
                <td className="p-6 px-8 border-r border-[#EAEAEA] text-[#EAEAEA]">-</td>
                <td className="p-6 px-8 border-r border-[#EAEAEA] text-[#002E23]"><Check size={20} className="text-[#002E23]" /></td>
                <td className="p-6 px-8 text-[#00221A]"><Check size={20} className="text-[#002E23]" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default Pricing;