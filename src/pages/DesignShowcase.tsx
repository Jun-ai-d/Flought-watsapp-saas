import React from 'react';

const DesignShowcase: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-12">
      <div className="border-b border-theme-border pb-6">
        <h1 className="text-3xl font-display font-bold text-theme-text mb-2">Flought Design System</h1>
        <p className="text-theme-text-muted">Interactive Theme Showcase</p>
      </div>

      <section className="space-y-6">
        <h2 className="text-xl font-bold border-b border-theme-border pb-2 text-theme-text">1. Typography & Colors</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="theme-card p-6 bg-theme-surface">
            <h3 className="font-bold text-theme-text-muted mb-4 uppercase text-sm tracking-wider">Secondary Typeface</h3>
            <p className="font-mono text-2xl text-theme-text mb-2">No. 00482</p>
            <p className="text-sm text-theme-text-muted">Used only for serial numbers, IDs, and timestamps.</p>
          </div>
          <div className="theme-card p-6 bg-theme-surface">
            <h3 className="font-bold text-theme-text-muted mb-4 uppercase text-sm tracking-wider">Primary UI Typeface</h3>
            <p className="font-display text-2xl text-theme-text mb-2">Conversation Inbox</p>
            <p className="text-sm text-theme-text-muted">Used for general dashboard UI, navigation, and body text.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <div className="p-4 border border-theme-border bg-theme-bg flex flex-col items-center justify-center h-32" style={{ borderRadius: 'var(--radius-card)' }}>
            <strong className="text-theme-text">Background</strong>
          </div>
          <div className="p-4 bg-theme-text text-theme-bg flex flex-col items-center justify-center h-32" style={{ borderRadius: 'var(--radius-card)' }}>
            <strong>Primary Text</strong>
          </div>
          <div className="p-4 bg-brand-accent text-white flex flex-col items-center justify-center h-32" style={{ borderRadius: 'var(--radius-card)' }}>
            <strong>Accent / Brand</strong>
          </div>
          <div className="p-4 border border-theme-text-muted text-theme-text-muted bg-theme-surface flex flex-col items-center justify-center h-32" style={{ borderRadius: 'var(--radius-card)' }}>
            <strong>Muted / Borders</strong>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-bold border-b border-theme-border pb-2 text-theme-text">2. Badges & Indicators</h2>
        <div className="flex flex-wrap gap-4 p-8 bg-theme-surface border border-theme-border" style={{ borderRadius: 'var(--radius-card)' }}>
          <span className="px-3 py-1 bg-green-500/10 text-green-500 border border-green-500/20 text-xs font-bold uppercase tracking-wider" style={{ borderRadius: 'var(--radius-button)' }}>RESOLVED</span>
          <span className="px-3 py-1 bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 text-xs font-bold uppercase tracking-wider" style={{ borderRadius: 'var(--radius-button)' }}>HANDOVER</span>
          <span className="px-3 py-1 bg-brand-accent/10 text-brand-accent border border-brand-accent/20 text-xs font-bold uppercase tracking-wider" style={{ borderRadius: 'var(--radius-button)' }}>PENDING</span>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-bold border-b border-theme-border pb-2 text-theme-text">3. Interactive Elements</h2>
        <div className="flex gap-4 p-8 bg-theme-surface border border-theme-border" style={{ borderRadius: 'var(--radius-card)' }}>
          <button className="px-6 py-2 border border-theme-border text-theme-text font-bold hover:bg-theme-surface-hover transition-colors theme-button">Secondary Action</button>
          <button className="px-6 py-2 bg-brand-accent text-white font-bold hover:bg-brand-accent-light transition-colors theme-button shadow-md">Primary Action</button>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-bold border-b border-theme-border pb-2 text-theme-text">4. Data Lists</h2>
        <div className="bg-theme-surface border border-theme-border overflow-hidden" style={{ borderRadius: 'var(--radius-card)' }}>
          <ul className="divide-y divide-theme-border">
            <li className="p-4 flex items-center hover:bg-theme-surface-hover transition-colors">
              <span className="font-mono text-theme-text-muted w-24">No. 00482</span>
              <span className="font-bold text-theme-text w-48">Arjun Patel</span>
              <span className="px-2 py-1 bg-green-500/10 text-green-500 border border-green-500/20 text-[10px] font-bold uppercase mx-auto" style={{ borderRadius: 'var(--radius-button)' }}>RESOLVED</span>
              <span className="text-theme-text-muted text-sm flex-1 text-right">Auto-resolved via FAQ</span>
            </li>
            <li className="p-4 flex items-center hover:bg-theme-surface-hover transition-colors">
              <span className="font-mono text-theme-text-muted w-24">No. 00483</span>
              <span className="font-bold text-theme-text w-48">Priya Sharma</span>
              <span className="px-2 py-1 bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 text-[10px] font-bold uppercase mx-auto" style={{ borderRadius: 'var(--radius-button)' }}>HANDOVER</span>
              <span className="text-theme-text-muted text-sm flex-1 text-right">Trigger: Low confidence</span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
};

export default DesignShowcase;
