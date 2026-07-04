import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Bot, Users, Zap, Shield, ChevronRight, CheckCircle2, ArrowRight, Star, Plus, Minus } from 'lucide-react';

const LandingPage: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: "What happens if the AI doesn't know the answer?",
      a: "Our AI is explicitly instructed never to hallucinate. If an answer isn't in your knowledge base, it gracefully apologizes to the customer and instantly notifies a human agent in your dashboard to take over."
    },
    {
      q: "How long does it take to set up?",
      a: "Under 5 minutes. Connect your WhatsApp Business API, upload a PDF or enter some text FAQs, and the AI is instantly trained and ready to respond to customers."
    },
    {
      q: "Is my conversational data private?",
      a: "Absolutely. We use strict Row Level Security (RLS) so your data is isolated. We only use your data to answer your customers' queries, and we never train public models on your private business data."
    },
    {
      q: "What if I exceed my monthly message limit?",
      a: "Your bot will never go offline. We use a graceful overage billing system. Any messages beyond your tier limit are simply billed at a standard overage rate at the end of the month."
    }
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white overflow-hidden selection:bg-[#C1440E] selection:text-white font-sans">
      {/* Dynamic Background Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#C1440E]/15 blur-[120px] mix-blend-screen animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-[#8B5CF6]/10 blur-[150px] mix-blend-screen animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-6 py-4 md:px-12 backdrop-blur-md bg-[#0A0A0A]/70 border-b border-white/10 sticky top-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#C1440E] to-[#8B5CF6] flex items-center justify-center shadow-[0_0_15px_rgba(193,68,14,0.5)]">
            <MessageSquare size={18} className="text-white" />
          </div>
          <span className="text-2xl font-display font-bold tracking-tight">Flought</span>
        </div>
        <div className="flex items-center gap-8">
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-300">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Log In</Link>
            <Link to="/login" className="px-5 py-2.5 text-sm font-medium text-white bg-white/10 hover:bg-white/20 border border-white/10 rounded-full transition-all hover:scale-105">
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-24 pb-20 px-6 md:px-12 max-w-7xl mx-auto flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-gray-300 mb-8 backdrop-blur-sm shadow-xl">
          <Zap size={14} className="text-[#C1440E]" />
          <span>Conversational Memory is now live</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-extrabold tracking-tighter mb-8 leading-[1.05] max-w-5xl">
          Automate WhatsApp. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C1440E] via-[#ff6b2b] to-[#8B5CF6] animate-gradient-x">
            Never Miss a Sale.
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-gray-400 mb-12 max-w-3xl leading-relaxed">
          Instantly resolve 80% of customer queries with AI trained on your own FAQs. When the AI isn't absolutely certain, it seamlessly hands over to your human agents in a unified inbox.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center w-full sm:w-auto">
          <Link to="/login" className="px-8 py-4 w-full sm:w-auto text-lg font-bold text-white bg-[#C1440E] hover:bg-[#d65a24] rounded-full shadow-[0_0_30px_rgba(193,68,14,0.4)] transition-all hover:scale-105 flex items-center justify-center gap-2 group">
            Start Your 14-Day Free Trial
            <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
        <p className="mt-4 text-sm text-gray-500">No credit card required. Setup in 5 minutes.</p>

        {/* Hero Image */}
        <div className="mt-20 w-full max-w-5xl relative group perspective-1000">
          <div className="absolute inset-0 bg-gradient-to-tr from-[#C1440E]/30 to-[#8B5CF6]/30 rounded-3xl blur-3xl transform group-hover:scale-105 transition-transform duration-700"></div>
          <img 
            src="/hero-ai.png" 
            alt="AI connecting to smartphone" 
            className="relative z-10 w-full h-auto rounded-3xl border border-white/10 shadow-2xl"
          />
        </div>
      </section>

      {/* Trusted By Marquee */}
      <section className="relative z-10 py-10 border-y border-white/5 bg-black/40 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 mb-6 text-center text-sm font-medium text-gray-500 uppercase tracking-widest">
          Trusted by modern businesses scaling on WhatsApp
        </div>
        <div className="flex gap-16 items-center w-max animate-marquee opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
          {[...Array(2)].map((_, i) => (
            <React.Fragment key={i}>
              <div className="text-2xl font-bold font-display">Acme Corp</div>
              <div className="text-2xl font-bold font-display">GlobalMed</div>
              <div className="text-2xl font-bold font-display">FastRetail</div>
              <div className="text-2xl font-bold font-display">TechFlow</div>
              <div className="text-2xl font-bold font-display">Nexus Clinics</div>
              <div className="text-2xl font-bold font-display">Apex Auto</div>
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="relative z-10 py-32 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">Enterprise-grade architecture.</h2>
            <p className="text-gray-400 text-xl max-w-2xl mx-auto">Built from the ground up for massive concurrency, extreme speed, and zero AI hallucinations.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-10 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors group">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#C1440E]/20 to-[#8B5CF6]/20 flex items-center justify-center mb-8 border border-white/10 group-hover:scale-110 transition-transform">
                <Bot size={28} className="text-[#C1440E]" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Conversational RAG</h3>
              <p className="text-gray-400 leading-relaxed text-lg">Our AI remembers the last 6 messages. It flawlessly tracks pronouns and follow-up questions for a natural chatting experience.</p>
            </div>
            
            <div className="p-10 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors group">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8B5CF6]/20 to-blue-500/20 flex items-center justify-center mb-8 border border-white/10 group-hover:scale-110 transition-transform">
                <Users size={28} className="text-[#8B5CF6]" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Seamless Handoff</h3>
              <p className="text-gray-400 leading-relaxed text-lg">If the AI's confidence drops, it gracefully apologizes and routes the chat to a human agent. Agents take over in our unified inbox.</p>
            </div>
            
            <div className="p-10 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors group">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500/20 to-[#C1440E]/20 flex items-center justify-center mb-8 border border-white/10 group-hover:scale-110 transition-transform">
                <Shield size={28} className="text-green-500" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Zero Hallucinations</h3>
              <p className="text-gray-400 leading-relaxed text-lg">Strict JSON generation and HNSW vector indexing guarantees the bot only speaks truth based on your uploaded Knowledge Base.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="relative z-10 py-32 px-6 md:px-12 bg-black/60 border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">How Flought Works</h2>
            <p className="text-gray-400 text-xl max-w-2xl mx-auto">Go from zero to a fully automated WhatsApp support funnel in under 5 minutes.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            {/* Connecting lines for desktop */}
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-[#C1440E] to-[#8B5CF6] opacity-30"></div>

            <div className="relative text-center">
              <div className="w-24 h-24 mx-auto bg-[#0A0A0A] border-2 border-[#C1440E] rounded-full flex items-center justify-center text-3xl font-display font-bold text-[#C1440E] mb-6 relative z-10 shadow-[0_0_30px_rgba(193,68,14,0.3)]">1</div>
              <h3 className="text-2xl font-bold mb-4">Connect WhatsApp</h3>
              <p className="text-gray-400">Scan a QR code or paste your API keys to link your official WhatsApp Business number.</p>
            </div>

            <div className="relative text-center">
              <div className="w-24 h-24 mx-auto bg-[#0A0A0A] border-2 border-white/20 rounded-full flex items-center justify-center text-3xl font-display font-bold text-white mb-6 relative z-10">2</div>
              <h3 className="text-2xl font-bold mb-4">Add Knowledge</h3>
              <p className="text-gray-400">Upload your PDFs, refund policies, and FAQs. Our system instantly vectorizes them for AI retrieval.</p>
            </div>

            <div className="relative text-center">
              <div className="w-24 h-24 mx-auto bg-[#0A0A0A] border-2 border-[#8B5CF6] rounded-full flex items-center justify-center text-3xl font-display font-bold text-[#8B5CF6] mb-6 relative z-10 shadow-[0_0_30px_rgba(139,92,246,0.3)]">3</div>
              <h3 className="text-2xl font-bold mb-4">Automate & Scale</h3>
              <p className="text-gray-400">Watch as the AI resolves 80% of incoming tickets instantly, while your team handles the complex 20%.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="relative z-10 py-32 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">Loved by operators.</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md">
              <div className="flex gap-1 mb-6 text-[#C1440E]">
                <Star size={20} fill="currentColor" />
                <Star size={20} fill="currentColor" />
                <Star size={20} fill="currentColor" />
                <Star size={20} fill="currentColor" />
                <Star size={20} fill="currentColor" />
              </div>
              <p className="text-lg text-gray-300 mb-8 font-medium">"We used to miss leads because our front desk couldn't reply to WhatsApp fast enough. Flought now books 40% of our appointments automatically at 2 AM."</p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full"></div>
                <div>
                  <div className="font-bold">Dr. Arjun Sharma</div>
                  <div className="text-sm text-gray-500">Owner, Nexus Clinics</div>
                </div>
              </div>
            </div>
            
            <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md md:-translate-y-4">
              <div className="flex gap-1 mb-6 text-[#C1440E]">
                <Star size={20} fill="currentColor" />
                <Star size={20} fill="currentColor" />
                <Star size={20} fill="currentColor" />
                <Star size={20} fill="currentColor" />
                <Star size={20} fill="currentColor" />
              </div>
              <p className="text-lg text-gray-300 mb-8 font-medium">"The human handoff is flawless. Customers don't even realize they were talking to an AI until my team steps in to handle the complex shipping queries."</p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full"></div>
                <div>
                  <div className="font-bold">Priya Patel</div>
                  <div className="text-sm text-gray-500">CX Head, FastRetail</div>
                </div>
              </div>
            </div>

            <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md">
              <div className="flex gap-1 mb-6 text-[#C1440E]">
                <Star size={20} fill="currentColor" />
                <Star size={20} fill="currentColor" />
                <Star size={20} fill="currentColor" />
                <Star size={20} fill="currentColor" />
                <Star size={20} fill="currentColor" />
              </div>
              <p className="text-lg text-gray-300 mb-8 font-medium">"I've tried 5 different WhatsApp SaaS tools. None of them had this level of design or speed. Flought's unified inbox feels like magic."</p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full"></div>
                <div>
                  <div className="font-bold">Rahul Mehta</div>
                  <div className="text-sm text-gray-500">Founder, Acme Corp</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative z-10 py-32 px-6 md:px-12 bg-black/40 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">Clear, predictable pricing</h2>
            <p className="text-gray-400 text-xl max-w-2xl mx-auto">Graceful overage billing so your bot never goes offline.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center max-w-6xl mx-auto">
            {/* Starter */}
            <div className="p-10 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-md">
              <h3 className="text-xl text-gray-300 font-medium mb-2">Starter</h3>
              <div className="text-5xl font-bold mb-2">₹1,999<span className="text-lg text-gray-500 font-normal">/mo</span></div>
              <p className="text-sm text-gray-400 mb-8 pb-8 border-b border-white/10">Perfect for single-location clinics & shops.</p>
              <ul className="space-y-4 mb-10">
                <li className="flex items-center gap-3 text-gray-300"><CheckCircle2 size={20} className="text-[#C1440E]" /> 1,500 Utility messages</li>
                <li className="flex items-center gap-3 text-gray-300"><CheckCircle2 size={20} className="text-[#C1440E]" /> 200 Marketing messages</li>
                <li className="flex items-center gap-3 text-gray-300"><CheckCircle2 size={20} className="text-[#C1440E]" /> 500 AI RAG queries</li>
              </ul>
              <Link to="/login" className="block w-full py-4 text-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors font-bold">Select Starter</Link>
            </div>
            
            {/* Growth (Highlighted) */}
            <div className="p-10 rounded-[2.5rem] bg-gradient-to-b from-[#C1440E]/20 to-[#8B5CF6]/10 border border-[#C1440E]/50 backdrop-blur-xl relative transform md:-translate-y-8 shadow-[0_0_50px_rgba(193,68,14,0.2)]">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#C1440E] to-[#8B5CF6] text-white px-6 py-2 rounded-full text-sm font-bold tracking-wider uppercase shadow-lg">Most Popular</div>
              <h3 className="text-xl text-white font-medium mb-2">Growth</h3>
              <div className="text-6xl font-bold mb-2">₹4,999<span className="text-xl text-gray-400 font-normal">/mo</span></div>
              <p className="text-sm text-gray-300 mb-8 pb-8 border-b border-white/20">For multi-agent teams & active reminders.</p>
              <ul className="space-y-4 mb-10">
                <li className="flex items-center gap-3 text-white font-medium"><CheckCircle2 size={20} className="text-[#8B5CF6]" /> 4,000 Utility messages</li>
                <li className="flex items-center gap-3 text-white font-medium"><CheckCircle2 size={20} className="text-[#8B5CF6]" /> 500 Marketing messages</li>
                <li className="flex items-center gap-3 text-white font-medium"><CheckCircle2 size={20} className="text-[#8B5CF6]" /> 1,500 AI RAG queries</li>
              </ul>
              <Link to="/login" className="block w-full py-4 text-center rounded-xl bg-[#C1440E] hover:bg-[#d65a24] transition-colors font-bold shadow-lg text-lg">Start Free Trial</Link>
            </div>
            
            {/* Pro */}
            <div className="p-10 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-md">
              <h3 className="text-xl text-gray-300 font-medium mb-2">Pro</h3>
              <div className="text-5xl font-bold mb-2">₹9,999<span className="text-lg text-gray-500 font-normal">/mo</span></div>
              <p className="text-sm text-gray-400 mb-8 pb-8 border-b border-white/10">For heavy usage & multi-location businesses.</p>
              <ul className="space-y-4 mb-10">
                <li className="flex items-center gap-3 text-gray-300"><CheckCircle2 size={20} className="text-[#C1440E]" /> 10,000 Utility messages</li>
                <li className="flex items-center gap-3 text-gray-300"><CheckCircle2 size={20} className="text-[#C1440E]" /> 1,500 Marketing messages</li>
                <li className="flex items-center gap-3 text-gray-300"><CheckCircle2 size={20} className="text-[#C1440E]" /> 4,000 AI RAG queries</li>
              </ul>
              <Link to="/login" className="block w-full py-4 text-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors font-bold">Select Pro</Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative z-10 py-32 px-6 md:px-12 max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">Frequently Asked Questions</h2>
        </div>
        
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div 
              key={index} 
              className="border border-white/10 rounded-2xl bg-white/5 backdrop-blur-sm overflow-hidden transition-all duration-300"
            >
              <button 
                className="w-full px-6 py-6 flex items-center justify-between text-left focus:outline-none"
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
              >
                <span className="text-lg font-bold">{faq.q}</span>
                <div className={`w-8 h-8 rounded-full bg-white/5 flex items-center justify-center transition-transform duration-300 ${openFaq === index ? 'rotate-180 bg-[#C1440E]/20 text-[#C1440E]' : ''}`}>
                  {openFaq === index ? <Minus size={16} /> : <Plus size={16} />}
                </div>
              </button>
              
              <div 
                className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${openFaq === index ? 'max-h-40 pb-6 opacity-100' : 'max-h-0 opacity-0'}`}
              >
                <p className="text-gray-400 text-lg">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-32 px-6 md:px-12 text-center">
        <div className="max-w-4xl mx-auto p-16 rounded-[3rem] bg-gradient-to-tr from-[#C1440E]/20 to-[#8B5CF6]/20 border border-white/20 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-black/40"></div>
          <div className="relative z-10">
            <h2 className="text-5xl font-display font-bold mb-6">Ready to scale your support?</h2>
            <p className="text-xl text-gray-300 mb-10">Join modern businesses using Flought to automate WhatsApp and drive revenue while they sleep.</p>
            <Link to="/login" className="inline-flex items-center gap-2 px-10 py-5 text-lg font-bold text-white bg-white hover:bg-gray-100 text-black rounded-full shadow-xl transition-all hover:scale-105">
              Start Free Trial <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>

      {/* Mega Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-[#050505] pt-20 pb-10 px-6 md:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#C1440E] to-[#8B5CF6] flex items-center justify-center">
                <MessageSquare size={18} className="text-white" />
              </div>
              <span className="text-2xl font-display font-bold">Flought</span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              The enterprise-grade WhatsApp automation platform built for modern businesses. Zero hallucinations, flawless handoffs.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold text-white mb-6 uppercase tracking-wider text-sm">Product</h4>
            <ul className="space-y-4 text-sm text-gray-500">
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#how-it-works" className="hover:text-white transition-colors">How it works</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
              <li><Link to="/showcase" className="hover:text-white transition-colors">Design Showcase</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-white mb-6 uppercase tracking-wider text-sm">Legal</h4>
            <ul className="space-y-4 text-sm text-gray-500">
              <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/refund" className="hover:text-white transition-colors">Refund & Cancellation</Link></li>
              <li><Link to="/privacy" className="hover:text-white transition-colors">DPA</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-white mb-6 uppercase tracking-wider text-sm">Support</h4>
            <ul className="space-y-4 text-sm text-gray-500">
              <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-white transition-colors">API Documentation</a></li>
              <li><a href="mailto:support@flought.com" className="hover:text-white transition-colors">support@flought.com</a></li>
            </ul>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-gray-600 text-sm">
            &copy; {new Date().getFullYear()} Flought Inc. All rights reserved.
          </div>
          <div className="flex items-center gap-6 text-gray-600">
            <span className="text-sm">Made with precision.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
