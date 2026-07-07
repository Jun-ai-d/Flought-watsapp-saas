import React from 'react';
import { Bot, MessageSquare, Database, Zap, Workflow, ShoppingCart, Activity, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';

const Features: React.FC = () => {
  return (
    <div className="w-full bg-[#FAFAFA] text-[#00221A]">
      <Helmet>
        <title>System Specs & Features | Flought</title>
        <meta name="description" content="Explore Flought's powerful features including pgvector RAG, automated Drip Campaigns, Shopify catalog synchronization, and intelligent human-handoff." />
        <link rel="canonical" href="https://flought.com/features" />
      </Helmet>

      {/* Header */}
      <section className="py-24 bg-white border-b border-[#EAEAEA] relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 relative z-10 text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight text-[#00221A]">
            System Specifications
          </h1>
          <p className="text-xl md:text-2xl text-[#4A6B5D] max-w-3xl mx-auto font-medium">
            Not just a bot. A complete operating system for WhatsApp commerce and support.
          </p>
        </div>
      </section>

      {/* Feature 1: Strict RAG */}
      <section className="py-24 bg-[#FAFAFA]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-8 shadow-sm border border-[#EAEAEA]">
                <Database size={32} className="text-[#002E23]" />
              </div>
              <h2 className="text-4xl font-bold text-[#00221A] mb-6 tracking-tight">Strict Vector RAG</h2>
              <p className="text-lg text-[#4A6B5D] mb-8 leading-relaxed">
                Most AI bots hallucinate. Flought uses Supabase pgvector to strictly limit responses to your provided PDFs and website data.
              </p>
              <ul className="space-y-4 text-lg font-medium text-[#00221A]">
                <li className="flex items-start gap-3">
                  <span className="text-[#002E23] mt-1">•</span>
                  Instant embedding of PDFs & text blocks.
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#002E23] mt-1">•</span>
                  AI answers ONLY based on vectorized context.
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#002E23] mt-1">•</span>
                  Unknowns result in graceful human fallback.
                </li>
              </ul>
            </div>
            
            <div className="flex-1 w-full">
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#EAEAEA]">
                <div className="border-b border-[#EAEAEA] pb-3 mb-6 flex justify-between text-sm font-semibold text-[#4A6B5D] uppercase tracking-wider">
                  <span>System Log</span>
                  <span className="text-[#002E23]">Active</span>
                </div>
                
                <div className="space-y-6">
                  {/* Customer msg */}
                  <div className="bg-[#FAFAFA] border border-[#EAEAEA] rounded-2xl p-5 w-4/5">
                    <div className="text-xs font-semibold text-[#4A6B5D] mb-2 uppercase tracking-wide">Customer</div>
                    <p className="font-medium text-[#00221A]">What is your refund policy for annual plans?</p>
                  </div>
                  
                  {/* System log */}
                  <div className="flex justify-center">
                    <div className="bg-[#002E23]/5 text-[#002E23] text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-2 border border-[#002E23]/10">
                      <span className="w-2 h-2 rounded-full bg-[#002E23] animate-pulse"></span>
                      Executing similarity search
                    </div>
                  </div>

                  {/* AI msg */}
                  <div className="bg-[#002E23] text-white rounded-2xl p-5 w-4/5 ml-auto shadow-md">
                    <div className="text-xs font-semibold text-white/70 mb-2 uppercase tracking-wide flex items-center gap-2">
                      <Bot size={14} /> AI Assistant
                    </div>
                    <p className="font-medium">For annual plans, we offer a full refund if requested within the first 30 days. Need billing support?</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 2: Campaign Engine */}
      <section className="py-24 bg-white border-y border-[#EAEAEA]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row-reverse items-center gap-16">
            <div className="flex-1">
              <div className="w-16 h-16 bg-[#FAFAFA] rounded-2xl flex items-center justify-center mb-8 border border-[#EAEAEA]">
                <Activity size={32} className="text-[#002E23]" />
              </div>
              <h2 className="text-4xl font-bold text-[#00221A] mb-6 tracking-tight">Campaign Engine</h2>
              <p className="text-lg text-[#4A6B5D] mb-8 leading-relaxed">
                Build automated WhatsApp drip sequences to nurture leads, recover abandoned carts, and re-engage dormant users seamlessly.
              </p>
              <ul className="space-y-4 text-lg font-medium text-[#00221A]">
                <li className="flex items-start gap-3">
                  <span className="text-[#002E23] mt-1">•</span>
                  Multi-day sequential messaging.
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#002E23] mt-1">•</span>
                  Trigger-based campaign entry points.
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#002E23] mt-1">•</span>
                  Rich WhatsApp template support.
                </li>
              </ul>
            </div>
            
            <div className="flex-1 w-full">
               <div className="bg-[#FAFAFA] rounded-3xl p-10 h-96 flex flex-col justify-center items-center border border-[#EAEAEA]">
                 
                 <div className="flex flex-col gap-4 items-center relative z-10 w-full max-w-sm">
                   <div className="bg-[#002E23] text-white font-semibold p-4 rounded-xl w-full text-center shadow-md">
                     Day 1: Welcome Offer
                   </div>
                   <div className="w-0.5 h-6 bg-[#EAEAEA]"></div>
                   <div className="bg-white border border-[#EAEAEA] font-semibold p-4 rounded-xl w-full text-center shadow-sm relative text-[#00221A]">
                     <span className="absolute -left-3 -top-3 bg-white text-[#002E23] border border-[#EAEAEA] px-2 py-1 rounded-md text-xs font-bold shadow-sm">Wait 24h</span>
                     Day 2: Check-in
                   </div>
                   <div className="w-0.5 h-6 bg-[#EAEAEA]"></div>
                   <div className="bg-white border border-[#EAEAEA] font-semibold p-4 rounded-xl w-full text-center shadow-sm relative opacity-60 text-[#00221A]">
                     <span className="absolute -left-3 -top-3 bg-white text-[#002E23] border border-[#EAEAEA] px-2 py-1 rounded-md text-xs font-bold shadow-sm">Wait 48h</span>
                     Day 4: Promo Code
                   </div>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 3: Commerce Sync */}
      <section className="py-24 bg-[#FAFAFA]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-8 border border-[#EAEAEA] shadow-sm">
                <ShoppingCart size={32} className="text-[#002E23]" />
              </div>
              <h2 className="text-4xl font-bold text-[#00221A] mb-6 tracking-tight">Commerce Sync</h2>
              <p className="text-lg text-[#4A6B5D] mb-8 leading-relaxed">
                Seamless native integrations with Shopify and CRMs. Manage catalogs and orders entirely over WhatsApp.
              </p>
              <ul className="space-y-4 text-lg font-medium text-[#00221A]">
                <li className="flex items-start gap-3">
                  <span className="text-[#002E23] mt-1">•</span>
                  Real-time Shopify catalog synchronization.
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#002E23] mt-1">•</span>
                  Order status tracking via conversational AI.
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#002E23] mt-1">•</span>
                  Automated CRM contact and lead creation.
                </li>
              </ul>
            </div>
            
            <div className="flex-1 w-full flex justify-center">
               <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#EAEAEA] w-full max-w-md relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-[#002E23] text-white font-bold text-xs uppercase px-4 py-1.5 rounded-bl-xl tracking-wider">
                  Sync Active
                </div>
                <div className="border-b border-[#EAEAEA] pb-3 mb-6 flex justify-between text-sm font-semibold text-[#4A6B5D] uppercase tracking-wider mt-2">
                  <span>Shopify_Webhook</span>
                  <span className="text-[#002E23]">200 OK</span>
                </div>
                <div className="bg-[#FAFAFA] border border-[#EAEAEA] text-[#002E23] font-mono text-sm p-5 rounded-xl overflow-x-auto">
                  <pre>{`{
  "topic": "orders/create",
  "shop_domain": "store.myshopify.com",
  "order_id": "837492847",
  "customer": {
    "phone": "+1234567890",
    "name": "Jane Doe"
  }
}`}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Feature 4: Handoff Intel */}
       <section className="py-24 bg-white border-y border-[#EAEAEA]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row-reverse items-center gap-16">
            <div className="flex-1">
              <div className="w-16 h-16 bg-[#FAFAFA] rounded-2xl flex items-center justify-center mb-8 border border-[#EAEAEA]">
                <MessageSquare size={32} className="text-[#002E23]" />
              </div>
              <h2 className="text-4xl font-bold text-[#00221A] mb-6 tracking-tight">Handoff Intel</h2>
              <p className="text-lg text-[#4A6B5D] mb-8 leading-relaxed">
                When the AI pauses, humans take over. Agents receive auto-generated conversation summaries so they never miss a beat.
              </p>
              <ul className="space-y-4 text-lg font-medium text-[#00221A]">
                <li className="flex items-start gap-3">
                  <span className="text-[#002E23] mt-1">•</span>
                  AI-generated handoff summaries.
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#002E23] mt-1">•</span>
                  Internal agent collaboration notes.
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#002E23] mt-1">•</span>
                  Real-time team inbox synchronization.
                </li>
              </ul>
            </div>
            
            <div className="flex-1 w-full">
               <div className="bg-[#FAFAFA] rounded-3xl border border-[#EAEAEA] shadow-sm flex flex-col h-96 overflow-hidden">
                 <div className="bg-white border-b border-[#EAEAEA] p-4 flex gap-4 items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#4A6B5D]">Agent Inbox View</span>
                 </div>
                 <div className="flex flex-1 overflow-hidden">
                   <div className="w-1/3 border-r border-[#EAEAEA] bg-white p-4 flex flex-col gap-4">
                     <div className="bg-[#FAFAFA] p-3 rounded-xl border border-[#EAEAEA]">
                       <div className="font-semibold text-sm text-[#00221A]">Jane Doe</div>
                       <div className="text-[10px] font-bold text-white bg-[#002E23] mt-2 px-2 py-1 inline-block rounded-md uppercase">Escalated</div>
                     </div>
                   </div>
                   <div className="w-2/3 p-6 flex flex-col gap-4">
                      <div className="bg-white border border-[#EAEAEA] p-4 rounded-xl text-sm font-medium text-[#00221A] relative shadow-sm">
                        <span className="absolute -top-2.5 -left-2.5 bg-white border border-[#EAEAEA] text-[#002E23] px-2 py-0.5 rounded-md text-[10px] font-bold uppercase shadow-sm">AI Summary</span>
                        User is asking about sizing for the Summer Collection. AI could not confirm inventory. Sent to human.
                      </div>
                      
                      <div className="bg-white border border-dashed border-[#EAEAEA] p-4 rounded-xl text-sm font-medium text-[#4A6B5D] text-center mt-auto">
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
      <section className="py-32 bg-[#FAFAFA] text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-4xl md:text-6xl font-bold text-[#00221A] mb-10 tracking-tight">Ready to deploy?</h2>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="inline-block">
            <Link to="/pricing" className="px-10 py-5 text-lg font-bold text-white bg-[#002E23] rounded-2xl flex items-center justify-center gap-3 shadow-md hover:bg-[#00392C] transition-all">
              See Pricing Options <ArrowRight size={20} />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Features;