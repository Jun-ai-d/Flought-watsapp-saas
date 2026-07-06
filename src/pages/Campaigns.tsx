import React, { useState } from 'react';
import { Megaphone, CalendarDays } from 'lucide-react';
import OneOffBroadcast from './OneOffBroadcast';
import DripSequences from './DripSequences';

const Campaigns: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'one-off' | 'drip'>('one-off');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex gap-4 border-b border-theme-border mb-8">
        <button
          onClick={() => setActiveTab('one-off')}
          className={`pb-3 font-bold px-4 flex items-center gap-2 transition-colors ${
            activeTab === 'one-off' 
              ? 'border-b-2 border-brand-accent text-brand-accent' 
              : 'text-theme-text-muted hover:text-theme-text hover:border-b-2 hover:border-theme-border border-b-2 border-transparent'
          }`}
        >
          <Megaphone size={18} />
          One-Off Broadcast
        </button>
        <button
          onClick={() => setActiveTab('drip')}
          className={`pb-3 font-bold px-4 flex items-center gap-2 transition-colors ${
            activeTab === 'drip' 
              ? 'border-b-2 border-brand-accent text-brand-accent' 
              : 'text-theme-text-muted hover:text-theme-text hover:border-b-2 hover:border-theme-border border-b-2 border-transparent'
          }`}
        >
          <CalendarDays size={18} />
          Drip Sequences
        </button>
      </div>

      {activeTab === 'one-off' ? <OneOffBroadcast /> : <DripSequences />}
    </div>
  );
};

export default Campaigns;
