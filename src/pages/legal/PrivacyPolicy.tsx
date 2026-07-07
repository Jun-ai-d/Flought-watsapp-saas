import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LinkedLogo } from '../../components/Logo';

const PrivacyPolicy: React.FC = () => {
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
      <main className="max-w-4xl mx-auto py-16 px-6">
        <div className="mb-12 border-b border-white/10 pb-8">
          <h1 className="text-4xl font-display font-bold text-white mb-4">Privacy Policy</h1>
          <p className="text-gray-400">Last Updated: July 2026</p>
        </div>

        <div className="space-y-12 text-sm md:text-base leading-relaxed text-gray-400">
          
          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-4">1. Introduction</h2>
            <p className="mb-4">
              Welcome to Flought. We are committed to protecting the privacy and security of our clients and their end-users. 
              This Privacy Policy explains how Flought ("we", "us", or "our") collects, uses, processes, and protects information 
              when you use our automated customer service and messaging software, including our integrations with the WhatsApp Business API.
            </p>
            <p>
              By accessing or using our services, you signify that you have read, understood, and agree to our collection, storage, 
              use, and disclosure of your personal information as described in this Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-4">2. Our Role as a Data Processor</h2>
            <p className="mb-4">
              Flought operates as a Business-to-Business (B2B) software provider. For the purposes of privacy regulations (including GDPR and CCPA), 
              Flought acts primarily as a <strong>Data Processor</strong> (or Service Provider) on behalf of our clients (the brands and businesses that use our platform), 
              who act as the <strong>Data Controllers</strong>.
            </p>
            <p>
              We only process the personal data of our clients' end-users (such as WhatsApp contacts and message content) strictly in accordance with 
              our clients' documented instructions to provide our automated routing, AI-assisted replies, and human handover services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-4">3. Information We Collect and Process</h2>
            <p className="mb-4">We collect and process the following types of information to provide our services:</p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li><strong>Client Account Information:</strong> Information provided by the businesses using our platform, such as company name, billing details, administrator email addresses, and passwords.</li>
              <li><strong>Messaging Data (WhatsApp Integration):</strong> To facilitate our AI automated reply and human handover service, we process inbound and outbound messages sent via the WhatsApp Business API. This includes end-user phone numbers, profile names provided by WhatsApp, timestamps, and the content of the messages (text and media).</li>
              <li><strong>Usage Data:</strong> We collect aggregated, non-personally identifiable telemetry data on how our platform is accessed and used to ensure stability and improve our AI models.</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-4">4. How We Use the Information</h2>
            <p className="mb-4">We use the information strictly to provide and improve our B2B services. Specifically, we use it to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Process inbound WhatsApp messages to generate automated AI responses based on our clients' provided Knowledge Bases.</li>
              <li>Route complex queries to human agents via our Unified Inbox.</li>
              <li>Provide analytics, billing, and customer support to our clients.</li>
              <li>Detect, prevent, and address technical issues or security breaches.</li>
            </ul>
            <p className="mt-4 font-bold text-white">We do not sell, rent, or use conversational data or end-user phone numbers for cross-context behavioral advertising or unauthorized secondary purposes.</p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-4">5. Third-Party Data Sharing (Meta and Service Providers)</h2>
            <p className="mb-4">
              To provide our service, we integrate with third-party platforms. By using our service, you acknowledge that we share necessary data with:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Meta Platforms, Inc. (WhatsApp):</strong> We process messages via the WhatsApp Business Platform. Data transmitted through this API is subject to Meta's Business Terms and WhatsApp's Commerce and Business Policies.</li>
              <li><strong>Cloud Hosting Providers:</strong> We use secure, enterprise-grade cloud providers (e.g., Supabase, AWS) to host our database and process AI queries.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-4">6. Data Retention and Deletion</h2>
            <p className="mb-4">
              We retain personal data and message logs only for as long as necessary to provide the service to our clients, or to comply with applicable legal obligations.
            </p>
            <p className="mb-4">
              End-users wishing to delete their conversational history or opt out of messaging must contact the specific Business (the Data Controller) they are interacting with. As a Data Processor, Flought will promptly execute data deletion requests initiated by our clients via our platform tools.
            </p>
            <p>
              When a client terminates their Flought account, all associated conversational data, knowledge bases, and user records are permanently deleted from our active systems within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-4">7. Data Security</h2>
            <p className="mb-4">
              We implement robust security measures to protect data from unauthorized access, disclosure, or destruction. 
              Our infrastructure utilizes strict Row Level Security (RLS) ensuring absolute tenant isolation—meaning one client cannot access another client's conversational data. 
              Data is encrypted in transit using TLS and at rest using industry-standard encryption protocols.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-4">8. Contact Us</h2>
            <p className="mb-4">
              If you have any questions about this Privacy Policy or our data practices, please contact our Privacy Team at:
            </p>
            <div className="bg-white/5 p-6 rounded-xl border border-white/10">
              <p className="text-white font-medium">Flought Privacy Team</p>
              <p>Email: hello@flought.com</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
