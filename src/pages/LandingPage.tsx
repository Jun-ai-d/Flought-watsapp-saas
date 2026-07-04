import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  return (
    <div className="landing-container">
      {/* Top Nav */}
      <nav className="landing-nav">
        <div className="logo font-record">Flought</div>
        <div className="nav-links">
          <Link to="/login" className="login-link">Log In</Link>
          <Link to="/login" className="btn btn-primary">Get Started</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        {/* Left: WhatsApp Mockup */}
        <div className="hero-visual">
          <div className="margin-rule-container">
            <div className="margin-rule" style={{ height: '100%', marginLeft: '2rem' }}></div>
          </div>
          
          <div className="wa-mockup">
            <div className="wa-header">
              <div className="wa-avatar"></div>
              <div className="wa-name">Arjun's Clinic</div>
            </div>
            <div className="wa-body">
              <div className="msg msg-in">
                Do you have any appointments available tomorrow morning?
                <div className="msg-time">10:42 AM</div>
              </div>
              
              <div className="msg msg-out">
                Yes, we have openings at 9:30 AM and 11:00 AM with Dr. Sharma. Would you like me to book one of these?
                <div className="msg-time">10:42 AM</div>
                
                {/* The Stamp Animation */}
                <div className="demo-stamp-container">
                  <span className="stamp-badge stamp-animate">AUTO-RESOLVED</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Copy */}
        <div className="hero-content">
          <h1 className="hero-title">WhatsApp automation that actually works.</h1>
          <p className="hero-subtitle">
            Instantly resolve customer queries with your own FAQs. When AI isn't sure, it seamlessly hands over to your team. 
            No more lost revenue from slow replies.
          </p>
          <div className="hero-actions">
            <Link to="/login" className="btn btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1.1rem' }}>See it in action</Link>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="pricing-section">
        <h2 className="section-title">Clear, predictable pricing</h2>
        <p className="section-subtitle text-gray">No hidden fees. Graceful overage billing so your bot never goes offline.</p>
        
        <div className="pricing-grid">
          <div className="pricing-card">
            <h3>Starter</h3>
            <div className="price font-record">₹1,999<span className="price-period">/mo</span></div>
            <p className="target-demo text-gray">Single-location shop/clinic</p>
            <ul className="feature-list">
              <li><strong>1,500</strong> Utility/Service messages</li>
              <li><strong>200</strong> Marketing messages</li>
              <li><strong>500</strong> AI RAG queries</li>
            </ul>
          </div>
          
          <div className="pricing-card highlighted">
            <h3>Growth</h3>
            <div className="price font-record">₹4,999<span className="price-period">/mo</span></div>
            <p className="target-demo text-gray">Multi-agent, active reminders</p>
            <ul className="feature-list">
              <li><strong>4,000</strong> Utility/Service messages</li>
              <li><strong>500</strong> Marketing messages</li>
              <li><strong>1,500</strong> AI RAG queries</li>
            </ul>
          </div>
          
          <div className="pricing-card">
            <h3>Pro</h3>
            <div className="price font-record">₹9,999<span className="price-period">/mo</span></div>
            <p className="target-demo text-gray">Multi-location, heavy usage</p>
            <ul className="feature-list">
              <li><strong>10,000</strong> Utility/Service messages</li>
              <li><strong>1,500</strong> Marketing messages</li>
              <li><strong>4,000</strong> AI RAG queries</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
