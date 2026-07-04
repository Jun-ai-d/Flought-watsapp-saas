import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, ArrowLeft } from 'lucide-react';

const TermsOfService: React.FC = () => {
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
        <h1 className="text-4xl font-display font-bold text-white mb-4">Terms of Service</h1>
        <p className="text-gray-400 mb-12">Last Updated: July 2026</p>

        <div className="space-y-8 text-sm md:text-base leading-relaxed">
          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-4">1. Acceptance of Terms</h2>
            <p className="mb-4">By accessing or using our services, you agree to be bound by these Terms. If you disagree with any part of the terms then you may not access the Service.</p>
          </section>
          
          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-4">2. Subscription and Billing</h2>
            <p className="mb-4">You will be billed in advance on a recurring and periodic basis ("Billing Cycle"). Billing cycles are set on a regular basis, typically monthly or yearly. At the end of each Billing Cycle, your Subscription will automatically renew under the exact same conditions unless you cancel it or Flought cancels it.</p>
            <p className="mb-4">Overage charges for messages sent beyond your tier limits will be billed at the end of the month based on our standard overage rates.</p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-4">3. Prohibited Uses</h2>
            <p className="mb-4">You may use Service only for lawful purposes and in accordance with Terms. You agree not to use Service:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>In any way that violates any applicable national or international law or regulation.</li>
              <li>For the purpose of exploiting, harming, or attempting to exploit or harm minors in any way.</li>
              <li>To transmit, or procure the sending of, any advertising or promotional material, including any "junk mail", "chain letter," "spam," or any other similar solicitation.</li>
              <li>In violation of WhatsApp's acceptable use policies.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-4">4. Limitation of Liability</h2>
            <p className="mb-4">In no event shall Flought, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.</p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default TermsOfService;
