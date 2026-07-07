import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LinkedLogo } from '../../components/Logo';

const DataDeletion: React.FC = () => {
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
          <h1 className="text-4xl font-display font-bold text-white mb-4">Data Deletion Instructions</h1>
          <p className="text-gray-400">Last Updated: July 2026</p>
        </div>

        <div className="space-y-12 text-sm md:text-base leading-relaxed text-gray-400">
          
          <section>
            <p className="mb-4">
              Flought respects your privacy and provides you with complete control over your personal data. 
              In compliance with the General Data Protection Regulation (GDPR), the California Consumer Privacy Act (CCPA), 
              and Meta Platform Policies, you have the right to request the deletion of your personal data from our systems.
            </p>
            <p className="mb-4">
              Please follow the instructions below depending on how you interact with our platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-4">For End-Users (WhatsApp Contacts)</h2>
            <p className="mb-4">
              If you have interacted with a brand or business that uses Flought for their automated customer service, 
              Flought acts solely as a Data Processor. The business you interacted with is the Data Controller.
            </p>
            <p className="mb-4 text-white font-semibold">How to delete your conversational data:</p>
            <ol className="list-decimal pl-6 space-y-3 mb-4">
              <li><strong>Contact the Business Directly:</strong> Please send a message (via WhatsApp, email, or their website) directly to the business you communicated with, requesting the deletion of your data.</li>
              <li><strong>Execution of Deletion:</strong> Once the business receives your request, they can use our platform tools to instantly purge your conversational history and contact profile from our databases.</li>
            </ol>
            <p className="text-sm">
              If a business is unresponsive, you can report the issue to us at <span className="text-emerald-400">hello@flought.com</span> and we will assist in facilitating the request with the Data Controller.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-4">For Flought Clients (Businesses)</h2>
            <p className="mb-4">
              If you are a business using the Flought platform and wish to delete your account or specific customer data:
            </p>
            <p className="mb-4 text-white font-semibold">To delete specific customer data:</p>
            <ol className="list-decimal pl-6 space-y-3 mb-4">
              <li>Log in to your Flought Dashboard.</li>
              <li>Navigate to the <strong>Contacts</strong> tab.</li>
              <li>Select the specific contact and click <strong>Delete Contact & History</strong>. This action is permanent and purges the data across all our servers.</li>
            </ol>
            <p className="mb-4 text-white font-semibold">To delete your entire account:</p>
            <ol className="list-decimal pl-6 space-y-3 mb-4">
              <li>Log in to your Flought Dashboard.</li>
              <li>Navigate to <strong>Settings</strong> &gt; <strong>Danger Zone</strong>.</li>
              <li>Click <strong>Delete Workspace</strong>.</li>
            </ol>
            <p>
              Deleting your workspace will immediately disconnect your WhatsApp Business API and permanently purge all conversational data, knowledge bases, AI models, and user records associated with your tenant within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-4">Contact Us</h2>
            <p className="mb-4">
              If you require further assistance with data deletion, please contact our support team at:
            </p>
            <div className="bg-white/5 p-6 rounded-xl border border-white/10">
              <p className="text-white font-medium">Flought Support</p>
              <p>Email: hello@flought.com</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default DataDeletion;
