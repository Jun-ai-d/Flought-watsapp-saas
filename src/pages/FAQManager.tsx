import React, { useState } from 'react';
import { Plus, Search, Trash2, Edit2 } from 'lucide-react';
import './FAQManager.css';

// VibeSec Note: In a real app, this data would come from the server and be rendered 
// strictly as text to prevent XSS. No dangerouslySetInnerHTML.
const MOCK_FAQS = [
  { id: 1, question: 'What are your hours of operation?', answer: 'We are open Monday to Friday from 9 AM to 6 PM, and Saturday from 10 AM to 4 PM. We are closed on Sundays.' },
  { id: 2, question: 'Where are you located?', answer: 'Our main clinic is located at 123 Healthcare Avenue, Mumbai, Maharashtra 400001.' },
  { id: 3, question: 'Do you offer tele-consultation?', answer: 'Yes, we offer video consultations for follow-up appointments. Please select the "Online" option when booking.' },
  { id: 4, question: 'What is your cancellation policy?', answer: 'We require 24 hours notice for cancellations. Late cancellations may be subject to a ₹500 fee.' },
];

const FAQManager: React.FC = () => {
  const [faqs, setFaqs] = useState(MOCK_FAQS);
  const [search, setSearch] = useState('');

  const filteredFaqs = faqs.filter(f => 
    f.question.toLowerCase().includes(search.toLowerCase()) || 
    f.answer.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">FAQ Manager</h1>
          <p className="text-gray">These answers are used by the AI to instantly resolve common queries.</p>
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={18} /> Add New FAQ
        </button>
      </div>

      <div className="content-panel margin-rule" style={{ marginLeft: '1rem' }}>
        <div className="panel-controls">
          <div className="search-box">
            <Search size={18} className="text-gray" />
            <input 
              type="text" 
              placeholder="Search existing FAQs..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="text-gray" style={{ fontSize: '0.9rem' }}>
            {filteredFaqs.length} {filteredFaqs.length === 1 ? 'entry' : 'entries'}
          </div>
        </div>

        <div className="faq-list">
          {filteredFaqs.map(faq => (
            <div key={faq.id} className="faq-card">
              <div className="faq-content">
                <h3 className="faq-question">{faq.question}</h3>
                <p className="faq-answer text-gray">{faq.answer}</p>
              </div>
              <div className="faq-actions">
                <button className="icon-btn text-gray" aria-label="Edit FAQ"><Edit2 size={18} /></button>
                <button className="icon-btn text-red" aria-label="Delete FAQ"><Trash2 size={18} /></button>
              </div>
            </div>
          ))}

          {filteredFaqs.length === 0 && (
            <div className="empty-state-simple">
              <p className="text-gray">No FAQs found matching your search.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FAQManager;
