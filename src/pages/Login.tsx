import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) {
    return <Navigate to="/inbox" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }
      
      navigate('/inbox');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Flought</h1>
          <p className="text-gray" style={{ marginTop: '0.5rem' }}>Agentic AI for WhatsApp</p>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          {error && (
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--accent-red)', color: 'white', fontSize: '0.9rem', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Work Email</label>
            <input 
              type="email" 
              id="email" 
              placeholder="you@company.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label htmlFor="password">Password</label>
              <a href="#" className="text-gray" style={{ fontSize: '0.85rem' }}>Forgot password?</a>
            </div>
            <input 
              type="password" 
              id="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="login-footer">
          <p className="text-gray" style={{ fontSize: '0.85rem' }}>
            Don't have an account? <a href="#" style={{ color: 'var(--text-indigo)', fontWeight: 600 }}>Request Access</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
