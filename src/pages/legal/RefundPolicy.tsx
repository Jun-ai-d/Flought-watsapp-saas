import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LinkedLogo } from '../../components/Logo';

const RefundPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-gray-300 font-sans selection:bg-[#059669] selection:text-white">
      {/* Simple Nav */}
      <nav className="flex items-center justify-between px-6 py-4 md:px-12 border-b border-white/10 sticky top-0 bg-[#0A0A0A]/90 backdrop-blur-md z-50">
        <Link to="/" className="flex items-center gap-2 text-white hover:text-[#059669] transition-colors">
          <ArrowLeft size={16} />
          <span className="text-sm font-medium">Back to Home</span>
        </Link>
        <div className="flex items-center gap-2">
          <LinkedLogo isWhite />
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-3xl mx-auto py-16 px-6">
        <h1 className="text-4xl font-display font-bold text-white mb-4">Refund & Cancellation Policy</h1>
        <p className="text-gray-400 mb-12">Last Updated: July 2026</p>

        <div className="space-y-8 text-sm md:text-base leading-relaxed">
          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-4">1. Subscription Cancellations</h2>
            <p className="mb-4">You may cancel your Flought subscription at any time. Your cancellation will take effect at the end of the current paid term. You will retain access to the Service through the end of your billing period.</p>
            <p className="mb-4">To cancel your subscription, please navigate to the "Billing" section in your Dashboard and select "Cancel Subscription".</p>
          </section>
          
          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-4">2. Refunds for Subscriptions</h2>
            <p className="mb-4">Due to the nature of software services and the costs associated with WhatsApp API provisioning, we do not offer refunds for partial months of service or for months where you have already utilized message credits.</p>
            <p className="mb-4">However, if you are unsatisfied with the service within the first 7 days of your initial purchase and have used less than 100 messages, you may contact our support team to request a full refund.</p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-4">3. Overage Charges</h2>
            <p className="mb-4">Overage charges (incurred for sending messages beyond your tier limits) are billed in arrears and are strictly non-refundable as they represent hard costs incurred by us from Meta/WhatsApp.</p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-4">4. Contacting Us</h2>
            <p className="mb-4">If you have any questions about our Returns and Refunds Policy, please contact us by email: support@flought.com</p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default RefundPolicy;
