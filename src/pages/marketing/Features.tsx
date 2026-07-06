import React from 'react';
import { Bot, MessageSquare, Database, Zap, Workflow, ShoppingCart, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const Features: React.FC = () => {
  return (
    <div className="w-full bg-[#f1f5f9]">
      {/* Header */}
      <section className="py-24 border-b-4 border-black bg-[#C1440E] text-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="border-l-8 border-white pl-8">
            <h1 className="text-6xl md:text-8xl font-black uppercase mb-6 leading-none">
              System <br/> Specs.
            </h1>
            <p className="text-2xl font-['Courier_Prime'] font-bold text-white/80 uppercase">
              Not just a bot. An OS for WhatsApp.
            </p>
          </div>
        </div>
      </section>

      {/* Feature 1: Strict RAG */}
      <section className="py-32 border-b-2 border-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1">
              <div className="w-20 h-20 bg-black flex items-center justify-center mb-8 border-4 border-black shadow-[8px_8px_0_0_#C1440E]">
                <Database size={40} className="text-white" />
              </div>
              <h2 className="text-5xl font-black text-black mb-6 uppercase">Strict Vector RAG</h2>
              <p className="text-xl font-['Courier_Prime'] font-bold text-black/70 mb-8 leading-relaxed">
                Most AI bots hallucinate. Flought uses Supabase pgvector to strictly limit responses to your provided PDFs and website data.
              </p>
              <ul className="space-y-4 font-['Courier_Prime'] font-bold text-lg">
                <li className="flex items-start gap-4">
                  <span className="text-white bg-black px-2 py-1">&gt;</span>
                  Instant embedding of PDFs & text blocks.
                </li>
                <li className="flex items-start gap-4">
                  <span className="text-white bg-black px-2 py-1">&gt;</span>
                  AI answers ONLY based on vectorized context.
                </li>
                <li className="flex items-start gap-4">
                  <span className="text-white bg-black px-2 py-1">&gt;</span>
                  Unknowns = graceful fallback.
                </li>
              </ul>
            </div>
            
            <div className="flex-1 w-full">
              <div className="bg-white border-4 border-black p-6 shadow-[16px_16px_0_0_#000]">
                <div className="border-b-2 border-black pb-2 mb-4 font-['Courier_Prime'] font-bold flex justify-between">
                  <span>TERMINAL_LOG</span>
                  <span className="text-black/50">10:42:01</span>
                </div>
                
                <div className="space-y-6">
                  {/* Customer msg */}
                  <div className="bg-[#f1f5f9] border-2 border-black p-4 w-3/4 shadow-[4px_4px_0_0_#000]">
                    <div className="font-['Courier_Prime'] text-xs font-bold text-black/50 mb-2 uppercase">Input.Customer</div>
                    <p className="font-bold">What is your refund policy for annual plans?</p>
                  </div>
                  
                  {/* System log */}
                  <div className="flex justify-center">
                    <div className="bg-black text-[#C1440E] font-['Courier_Prime'] font-bold text-xs px-4 py-2 border-2 border-[#C1440E]">
                      &gt; EXECUTING pgvector SIMILARITY SEARCH...
                    </div>
                  </div>

                  {/* AI msg */}
                  <div className="bg-[#C1440E] text-white border-2 border-black p-4 w-3/4 ml-auto shadow-[4px_4px_0_0_#000]">
                    <div className="font-['Courier_Prime'] text-xs font-bold text-white/70 mb-2 uppercase flex items-center gap-2">
                      <Bot size={14} /> Output.AI
                    </div>
                    <p className="font-bold">For annual plans, we offer a full refund if requested within the first 30 days. Need billing support?</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 2: Campaign Engine */}
      <section className="py-32 bg-white border-b-2 border-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row-reverse items-center gap-16">
            <div className="flex-1">
              <div className="w-20 h-20 bg-[#C1440E] flex items-center justify-center mb-8 border-4 border-black shadow-[8px_8px_0_0_#000]">
                <Activity size={40} className="text-white" />
              </div>
              <h2 className="text-5xl font-black text-black mb-6 uppercase">Campaign Engine</h2>
              <p className="text-xl font-['Courier_Prime'] font-bold text-black/70 mb-8 leading-relaxed">
                Build automated WhatsApp drip sequences to nurture leads, recover abandoned carts, and re-engage dormant users.
              </p>
              <ul className="space-y-4 font-['Courier_Prime'] font-bold text-lg">
                <li className="flex items-start gap-4">
                  <span className="text-white bg-[#C1440E] px-2 py-1">&gt;</span>
                  Multi-day sequential messaging.
                </li>
                <li className="flex items-start gap-4">
                  <span className="text-white bg-[#C1440E] px-2 py-1">&gt;</span>
                  Trigger-based campaign entry.
                </li>
                <li className="flex items-start gap-4">
                  <span className="text-white bg-[#C1440E] px-2 py-1">&gt;</span>
                  Rich WhatsApp template support.
                </li>
              </ul>
            </div>
            
            <div className="flex-1 w-full">
               <div className="border-4 border-black bg-white shadow-[16px_16px_0_0_#C1440E] p-6 h-80 flex flex-col justify-center">
                 <div className="flex flex-col gap-4 items-center">
                   <div className="bg-black text-white font-black uppercase p-4 border-2 border-black w-64 text-center">
                     Day 1: Welcome Offer
                   </div>
                   <div className="w-1 h-8 bg-black"></div>
                   <div className="bg-white border-4 border-black shadow-[4px_4px_0_0_#000] font-black uppercase p-4 w-64 text-center relative">
                     <span className="absolute -left-3 -top-3 bg-[#C1440E] text-white px-2 py-1 text-xs border border-black">&lt; WAIT 24H &gt;</span>
                     Day 2: Check-in
                   </div>
                    <div className="w-1 h-8 bg-black"></div>
                   <div className="bg-white border-4 border-black shadow-[4px_4px_0_0_#000] font-black uppercase p-4 w-64 text-center relative opacity-50">
                     <span className="absolute -left-3 -top-3 bg-black text-white px-2 py-1 text-xs border border-black">&lt; WAIT 48H &gt;</span>
                     Day 4: Promo Code
                   </div>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 3: Data Integrations */}
      <section className="py-32 border-b-2 border-black bg-[#f1f5f9]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1">
              <div className="w-20 h-20 bg-white border-4 border-black flex items-center justify-center mb-8 shadow-[8px_8px_0_0_#000]">
                <ShoppingCart size={40} className="text-black" />
              </div>
              <h2 className="text-5xl font-black text-black mb-6 uppercase">Commerce Sync</h2>
              <p className="text-xl font-['Courier_Prime'] font-bold text-black/70 mb-8 leading-relaxed">
                Seamless native integrations with Shopify and CRMs. Manage catalogs and orders entirely over WhatsApp.
              </p>
              <ul className="space-y-4 font-['Courier_Prime'] font-bold text-lg">
                <li className="flex items-start gap-4">
                  <span className="text-white bg-black px-2 py-1">&gt;</span>
                  Shopify catalog synchronization.
                </li>
                <li className="flex items-start gap-4">
                  <span className="text-white bg-black px-2 py-1">&gt;</span>
                  Order status tracking via bot.
                </li>
                <li className="flex items-start gap-4">
                  <span className="text-white bg-black px-2 py-1">&gt;</span>
                  Automated CRM contact creation.
                </li>
              </ul>
            </div>
            
            <div className="flex-1 w-full flex justify-center">
               <div className="bg-white border-4 border-black p-6 shadow-[16px_16px_0_0_#000] w-full max-w-md relative">
                <div className="absolute top-0 right-0 bg-green-500 text-white font-black uppercase px-3 py-1 border-b-4 border-l-4 border-black -translate-y-4 translate-x-4">
                  SYNC ACTIVE
                </div>
                <div className="border-b-2 border-black pb-2 mb-4 font-['Courier_Prime'] font-bold flex justify-between">
                  <span>SHOPIFY_WEBHOOK</span>
                  <span className="text-black/50">200 OK</span>
                </div>
                <div className="bg-black text-[#00ff00] font-['Courier_Prime'] text-sm p-4 overflow-hidden">
                  {`{
  "topic": "orders/create",
  "shop_domain": "store.myshopify.com",
  "order_id": "837492847",
  "customer": {
    "phone": "+1234567890",
    "name": "Jane Doe"
  }
}`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Feature 4: Collaborative Inbox */}
       <section className="py-32 bg-white border-b-2 border-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row-reverse items-center gap-16">
            <div className="flex-1">
              <div className="w-20 h-20 bg-[#C1440E] flex items-center justify-center mb-8 border-4 border-black shadow-[8px_8px_0_0_#000]">
                <MessageSquare size={40} className="text-white" />
              </div>
              <h2 className="text-5xl font-black text-black mb-6 uppercase">Handoff Intel</h2>
              <p className="text-xl font-['Courier_Prime'] font-bold text-black/70 mb-8 leading-relaxed">
                When the AI pauses, humans take over. Agents receive auto-generated conversation summaries so they never miss a beat.
              </p>
              <ul className="space-y-4 font-['Courier_Prime'] font-bold text-lg">
                <li className="flex items-start gap-4">
                  <span className="text-white bg-[#C1440E] px-2 py-1">&gt;</span>
                  AI-generated handoff summaries.
                </li>
                <li className="flex items-start gap-4">
                  <span className="text-white bg-[#C1440E] px-2 py-1">&gt;</span>
                  Internal agent collaboration notes.
                </li>
                <li className="flex items-start gap-4">
                  <span className="text-white bg-[#C1440E] px-2 py-1">&gt;</span>
                  Real-time inbox sync.
                </li>
              </ul>
            </div>
            
            <div className="flex-1 w-full">
               <div className="border-4 border-black bg-white shadow-[16px_16px_0_0_#C1440E] flex flex-col h-80">
                 <div className="border-b-4 border-black bg-black text-white p-3 font-['Courier_Prime'] font-bold flex gap-4 items-center">
                    <span className="text-xs uppercase tracking-widest text-[#C1440E]">Inbox.Agent.View</span>
                 </div>
                 <div className="flex flex-1 overflow-hidden">
                   <div className="w-1/3 border-r-4 border-black bg-[#f1f5f9] p-4 flex flex-col gap-4">
                     <div className="bg-white border-2 border-black p-3 shadow-[4px_4px_0_0_#000]">
                       <div className="font-bold uppercase text-sm">John Doe</div>
                       <div className="font-['Courier_Prime'] text-xs font-bold text-[#C1440E] bg-[#C1440E]/10 mt-2 px-2 py-1 inline-block border border-[#C1440E]">ESCALATED</div>
                     </div>
                   </div>
                   <div className="w-2/3 p-6 flex flex-col gap-4">
                      <div className="bg-yellow-100 border-2 border-black p-4 text-sm font-['Courier_Prime'] font-bold relative">
                        <span className="absolute -top-3 -left-3 bg-black text-white px-2 py-1 text-xs border border-black uppercase">AI Summary</span>
                        User is asking about sizing for the Summer Collection. AI could not confirm inventory. Sent to human.
                      </div>
                      
                      <div className="bg-black/5 border-2 border-dashed border-black/30 p-4 text-sm font-['Courier_Prime'] font-bold text-black/50 text-center mt-auto">
                        Type an internal note...
                      </div>
                   </div>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 bg-black text-center border-t-[16px] border-[#C1440E]">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-5xl md:text-7xl font-black text-white mb-12 uppercase leading-none">Ready to deploy?</h2>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95, y: 4, x: 4 }} className="inline-block">
            <Link to="/pricing" className="px-12 py-6 text-2xl font-black text-black bg-white border-4 border-black flex items-center justify-center gap-4 shadow-[12px_12px_0_0_#C1440E] uppercase tracking-widest hover:shadow-[6px_6px_0_0_#C1440E] hover:translate-x-[6px] hover:translate-y-[6px] transition-all">
              See Pricing
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Features;
