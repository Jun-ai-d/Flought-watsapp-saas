import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, ArrowLeft } from 'lucide-react';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-gray-300 font-sans selection:bg-[#C1440E] selection:text-white">
      {/* Simple Nav */}
      <nav className="flex items-center justify-between px-6 py-4 md:px-12 border-b border-white/10 sticky top-0 bg-[#0A0A0A]/90 backdrop-blur-md z-50">
        <Link to="/" className="flex items-center gap-2 text-white hover:text-[#C1440E] transition-colors">
          <ArrowLeft size={16} />
          <span className="text-sm font-medium">Back to Home</span>
        </Link>
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-[#C1440E]" />
          <span className="text-xl font-display font-bold text-white">Flought</span>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-3xl mx-auto py-16 px-6">
        <h1 className="text-4xl font-display font-bold text-white mb-4">Privacy Policy</h1>
        <p className="text-gray-400 mb-12">Last Updated: July 2026</p>

        <div className="space-y-8 text-sm md:text-base leading-relaxed">
          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-4">1. Information We Collect</h2>
            <p className="mb-4">We collect information you provide directly to us, such as when you create or modify your account, request on-demand services, contact customer support, or otherwise communicate with us. This information may include: name, email, phone number, postal address, profile picture, payment method, and other information you choose to provide.</p>
          </section>
          
          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-4">2. Use of Information</h2>
            <p className="mb-4">We may use the information we collect about you to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide, maintain, and improve our Services, including, for example, to facilitate payments, send receipts, provide products and services you request (and send related information), develop new features, provide customer support to Users and Drivers, develop safety features, authenticate users, and send product updates and administrative messages;</li>
              <li>Perform internal operations necessary to provide our Services, including to troubleshoot software bugs and operational problems; to conduct data analysis, testing, and research; and to monitor and analyze usage and activity trends;</li>
              <li>Send you communications we think will be of interest to you, including information about products, services, promotions, news, and events of Flought and other companies, where permissible and according to local applicable laws;</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-4">3. Data Security</h2>
            <p className="mb-4">We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access, disclosure, alteration and destruction. Our database utilizes Row Level Security (RLS) and is isolated on a per-tenant basis.</p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-4">4. WhatsApp Data</h2>
            <p className="mb-4">By using our service, you agree to comply with WhatsApp's Business Policy and Commerce Policy. We process WhatsApp messages strictly for the purpose of automated customer service and human handoff routing. We do not sell your conversational data.</p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
