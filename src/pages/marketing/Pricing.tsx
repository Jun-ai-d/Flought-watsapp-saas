import React from 'react';
import { Check, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useTransform } from 'framer-motion';

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
    <div className="w-full bg-[#f1f5f9] pb-32">
      {/* Header */}
      <section className="pt-24 pb-16 text-center px-6">
        <h1 className="text-6xl md:text-8xl font-black text-black mb-6 uppercase tracking-tighter">
          Transparent Pricing.
        </h1>
        <p className="text-2xl font-['Courier_Prime'] font-bold text-black/70 max-w-2xl mx-auto uppercase">
          Start for free, upgrade when you hit scale. No hidden fees.
        </p>
      </section>

      {/* Pricing Cards */}
      <section className="max-w-6xl mx-auto px-6 mb-32">
        <div className="grid md:grid-cols-3 gap-8 items-stretch">
          
          {/* Free Tier */}
          <TiltCard>
            <div className="bg-white border-4 border-black p-8 shadow-[8px_8px_0_0_#000] h-full flex flex-col">
              <h2 className="text-3xl font-black text-black uppercase mb-2">Free Pack</h2>
              <p className="font-['Courier_Prime'] font-bold text-sm text-black/60 mb-6 h-10 uppercase">
                Perfect for testing the waters.
              </p>
              <div className="mb-8">
                <span className="text-5xl font-black">$0</span>
                <span className="text-xl font-['Courier_Prime'] font-bold text-black/50">/mo</span>
              </div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98, x: 2, y: 2 }}>
                <Link to="/signup" className="block w-full py-4 text-center font-black uppercase border-2 border-black bg-[#f1f5f9] hover:bg-black hover:text-white transition-colors mb-8 shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000]">
                  Start for Free
                </Link>
              </motion.div>
              <div className="flex-1">
                <p className="font-['Courier_Prime'] font-bold text-xs uppercase mb-4 text-black bg-black/10 inline-block px-2 py-1">What's Included</p>
                <ul className="space-y-4 font-bold">
                  <li className="flex items-center gap-3"><Check size={18} className="text-[#C1440E]" /> 100 Utility Messages / mo</li>
                  <li className="flex items-center gap-3"><Check size={18} className="text-[#C1440E]" /> 50 AI Queries / mo</li>
                  <li className="flex items-center gap-3"><Check size={18} className="text-[#C1440E]" /> 1 Human Agent</li>
                  <li className="flex items-center gap-3"><Check size={18} className="text-[#C1440E]" /> Basic RAG (1 PDF limit)</li>
                </ul>
              </div>
            </div>
          </TiltCard>

          {/* Starter Tier */}
          <TiltCard className="md:-mt-8 md:mb-8 relative z-10">
            <div className="bg-[#C1440E] text-white border-4 border-black p-8 shadow-[16px_16px_0_0_#000] h-full flex flex-col relative">
              <div className="absolute top-0 right-0 bg-black text-white font-['Courier_Prime'] font-bold text-xs px-3 py-1 border-b-4 border-l-4 border-black -translate-y-4 translate-x-4 uppercase">
                Most Popular
              </div>
              <h2 className="text-3xl font-black uppercase mb-2">Starter Pack</h2>
              <p className="font-['Courier_Prime'] font-bold text-sm text-white/80 mb-6 h-10 uppercase">
                For automating your initial support load.
              </p>
              <div className="mb-8">
                <span className="text-6xl font-black">$49</span>
                <span className="text-xl font-['Courier_Prime'] font-bold text-white/70">/mo</span>
              </div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98, x: 4, y: 4 }}>
                <Link to="/signup" className="block w-full py-4 text-center font-black uppercase border-2 border-black bg-black text-white hover:bg-white hover:text-black transition-colors mb-8 shadow-[8px_8px_0_0_#000] hover:shadow-[4px_4px_0_0_#000]">
                  Get Started
                </Link>
              </motion.div>
              <div className="flex-1">
                <p className="font-['Courier_Prime'] font-bold text-xs uppercase mb-4 text-[#C1440E] bg-white inline-block px-2 py-1">Everything in Free, plus</p>
                <ul className="space-y-4 font-bold">
                  <li className="flex items-center gap-3"><Check size={18} /> 2,000 Utility Messages / mo</li>
                  <li className="flex items-center gap-3"><Check size={18} /> 1,000 AI Queries / mo</li>
                  <li className="flex items-center gap-3"><Check size={18} /> 3 Human Agents</li>
                  <li className="flex items-center gap-3"><Check size={18} /> Flow Builder Access</li>
                  <li className="flex items-center gap-3"><Check size={18} /> Up to 10 PDFs (Knowledge)</li>
                </ul>
              </div>
            </div>
          </TiltCard>

          {/* Pro Tier */}
          <TiltCard>
            <div className="bg-white border-4 border-black p-8 shadow-[8px_8px_0_0_#000] h-full flex flex-col">
              <h2 className="text-3xl font-black text-black uppercase mb-2">Pro Pack</h2>
              <p className="font-['Courier_Prime'] font-bold text-sm text-black/60 mb-6 h-10 uppercase">
                For scaling operations needing API access.
              </p>
              <div className="mb-8">
                <span className="text-5xl font-black">$149</span>
                <span className="text-xl font-['Courier_Prime'] font-bold text-black/50">/mo</span>
              </div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98, x: 2, y: 2 }}>
                <Link to="/signup" className="block w-full py-4 text-center font-black uppercase border-2 border-black bg-black text-white hover:bg-[#C1440E] hover:border-black transition-colors mb-8 shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000]">
                  Go Pro
                </Link>
              </motion.div>
              <div className="flex-1">
                <p className="font-['Courier_Prime'] font-bold text-xs uppercase mb-4 text-white bg-black inline-block px-2 py-1">Everything in Starter, plus</p>
                <ul className="space-y-4 font-bold">
                  <li className="flex items-center gap-3"><Check size={18} className="text-[#C1440E]" /> 10,000 Utility Messages / mo</li>
                  <li className="flex items-center gap-3"><Check size={18} className="text-[#C1440E]" /> Unlimited AI Queries</li>
                  <li className="flex items-center gap-3"><Check size={18} className="text-[#C1440E]" /> Unlimited Agents</li>
                  <li className="flex items-center gap-3"><Check size={18} className="text-[#C1440E]" /> Unlimited Knowledge Docs</li>
                  <li className="flex items-center gap-3"><Check size={18} className="text-[#C1440E]" /> Developer API Access</li>
                </ul>
              </div>
            </div>
          </TiltCard>

        </div>
      </section>

      {/* Comparison Table */}
      <section className="max-w-5xl mx-auto px-6">
        <h2 className="text-4xl font-black text-center mb-12 uppercase tracking-tighter">Compare Plans in Detail</h2>
        <div className="overflow-x-auto bg-white border-4 border-black shadow-[16px_16px_0_0_#000]">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-black text-white border-b-4 border-black uppercase font-black text-sm">
                <th className="p-6 w-1/3">Features</th>
                <th className="p-6 border-l-2 border-white/20">Free Pack</th>
                <th className="p-6 border-l-2 border-white/20 bg-[#C1440E] text-white">Starter Pack</th>
                <th className="p-6 border-l-2 border-white/20">Pro Pack</th>
              </tr>
            </thead>
            <tbody className="font-bold text-sm">
              <tr className="border-b-2 border-black">
                <td className="p-6 border-r-2 border-black">Price</td>
                <td className="p-6 border-r-2 border-black">$0/mo</td>
                <td className="p-6 border-r-2 border-black text-[#C1440E]">$49/mo</td>
                <td className="p-6">$149/mo</td>
              </tr>
              <tr className="border-b-2 border-black bg-[#f1f5f9]">
                <td className="p-6 border-r-2 border-black font-['Courier_Prime']">Utility Messages</td>
                <td className="p-6 border-r-2 border-black">100</td>
                <td className="p-6 border-r-2 border-black text-[#C1440E]">2,000</td>
                <td className="p-6">10,000</td>
              </tr>
              <tr className="border-b-2 border-black">
                <td className="p-6 border-r-2 border-black font-['Courier_Prime']">AI Queries</td>
                <td className="p-6 border-r-2 border-black">50</td>
                <td className="p-6 border-r-2 border-black text-[#C1440E]">1,000</td>
                <td className="p-6">Unlimited</td>
              </tr>
              <tr className="border-b-2 border-black bg-[#f1f5f9]">
                <td className="p-6 border-r-2 border-black font-['Courier_Prime']">Human Agents</td>
                <td className="p-6 border-r-2 border-black">1</td>
                <td className="p-6 border-r-2 border-black text-[#C1440E]">3</td>
                <td className="p-6">Unlimited</td>
              </tr>
              <tr className="border-b-2 border-black">
                <td className="p-6 border-r-2 border-black font-['Courier_Prime']">Knowledge Base (PDFs)</td>
                <td className="p-6 border-r-2 border-black">1 Doc (max 2MB)</td>
                <td className="p-6 border-r-2 border-black text-[#C1440E]">10 Docs</td>
                <td className="p-6">Unlimited</td>
              </tr>
              <tr className="bg-[#f1f5f9]">
                <td className="p-6 border-r-2 border-black font-['Courier_Prime']">Flow Builder</td>
                <td className="p-6 border-r-2 border-black text-black/30">-</td>
                <td className="p-6 border-r-2 border-black text-[#C1440E]"><Check size={20} /></td>
                <td className="p-6"><Check size={20} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default Pricing;
