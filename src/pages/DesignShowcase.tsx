import React from 'react';

const DesignShowcase: React.FC = () => {
  return (
    <div className="main-content" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="margin-rule" style={{ marginBottom: '3rem' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>Flought Design System</h1>
        <p className="text-gray">Direction: "Duplicate Copy"</p>
      </div>

      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--text-indigo)', paddingBottom: '0.5rem' }}>1. Typography & Colors</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div>
            <h3>Record Face (Courier Prime)</h3>
            <p className="font-record" style={{ fontSize: '1.5rem', margin: '1rem 0' }}>No. 00482</p>
            <p className="font-record text-gray">Used only for serial numbers, IDs, and timestamps.</p>
          </div>
          <div>
            <h3>UI Face (Inter)</h3>
            <p style={{ fontSize: '1.5rem', margin: '1rem 0' }}>Conversation Inbox</p>
            <p className="text-gray">Used for general dashboard UI, navigation, and body text.</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          <div style={{ padding: '1rem', border: '1px solid var(--text-indigo)', flex: 1, backgroundColor: 'var(--bg-cream)' }}>
            <strong>Cream</strong> (Background)
            <div className="font-record text-gray">#F5F0E6</div>
          </div>
          <div style={{ padding: '1rem', color: 'var(--bg-cream)', flex: 1, backgroundColor: 'var(--text-indigo)' }}>
            <strong>Indigo</strong> (Primary Text)
            <div className="font-record" style={{ color: 'var(--gray-smudge)' }}>#1A1F3C</div>
          </div>
          <div style={{ padding: '1rem', color: 'var(--bg-cream)', flex: 1, backgroundColor: 'var(--accent-red)' }}>
            <strong>Red</strong> (Accent/Stamp)
            <div className="font-record" style={{ color: 'var(--bg-cream)' }}>#C1440E</div>
          </div>
          <div style={{ padding: '1rem', flex: 1, border: '1px solid var(--gray-smudge)', color: 'var(--gray-smudge)' }}>
            <strong>Gray</strong> (Audit Trail)
            <div className="font-record text-gray">#8B8378</div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--text-indigo)', paddingBottom: '0.5rem' }}>2. Stamp Badges</h2>
        <div style={{ display: 'flex', gap: '2rem', padding: '2rem', backgroundColor: '#fff', border: '1px solid var(--text-indigo)' }}>
          <span className="stamp-badge">RESOLVED</span>
          <span className="stamp-badge">HANDOVER</span>
          <span className="stamp-badge">PENDING</span>
        </div>
        <p className="text-gray" style={{ marginTop: '1rem' }}>Red only. Placed at a slight 3-degree rotation.</p>
      </section>

      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--text-indigo)', paddingBottom: '0.5rem' }}>3. Buttons (Flat)</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn">Secondary Action</button>
          <button className="btn btn-primary">Primary Action</button>
        </div>
        <p className="text-gray" style={{ marginTop: '1rem' }}>No rounded pills. No drop shadows. Ledger flat.</p>
      </section>

      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--text-indigo)', paddingBottom: '0.5rem' }}>4. Ledger List (Conversation Row)</h2>
        <div style={{ backgroundColor: '#fff', padding: '1rem', border: '1px solid var(--text-indigo)' }}>
          <ul className="ledger-list">
            <li className="ledger-row">
              <span className="font-record" style={{ minWidth: '100px' }}>No. 00482</span>
              <span style={{ fontWeight: 600, minWidth: '180px' }}>Arjun Patel</span>
              <span className="stamp-badge" style={{ marginLeft: 'auto', marginRight: '2rem' }}>RESOLVED</span>
              <span className="text-gray" style={{ minWidth: '350px', fontSize: '0.85rem' }}>Auto-resolved via FAQ [Hours of Operation]</span>
            </li>
            <li className="ledger-row">
              <span className="font-record" style={{ minWidth: '100px' }}>No. 00483</span>
              <span style={{ fontWeight: 600, minWidth: '180px' }}>Priya Sharma</span>
              <span className="stamp-badge" style={{ marginLeft: 'auto', marginRight: '2rem' }}>HANDOVER</span>
              <span className="text-gray" style={{ minWidth: '350px', fontSize: '0.85rem' }}>Trigger: Low confidence on RAG retrieval</span>
            </li>
          </ul>
        </div>
        <p className="text-gray" style={{ marginTop: '1rem' }}>Notice the gray text specifically marking the "duplicate copy" audit trail, distinct from customer details.</p>
      </section>

    </div>
  );
};

export default DesignShowcase;
