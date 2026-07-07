import React, { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { LinkedLogo } from '../components/Logo';

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

      if (error) throw error;
      navigate('/inbox');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-sans selection:bg-[#002E23] selection:text-white">
      {/* Left Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-[#FAFAFA]">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-10 flex justify-center">
            <LinkedLogo />
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white p-10 rounded-3xl shadow-xl shadow-[#00221A]/5 border border-[#EAEAEA]"
          >
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#00221A] mb-2">Welcome back</h2>
              <p className="text-[#4A6B5D]">Enter your credentials to continue.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium flex items-center gap-2"
                >
                  ⚠️ {error}
                </motion.div>
              )}

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-[#00221A]">Email address</label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3.5 bg-[#FAFAFA] border border-[#EAEAEA] rounded-xl text-[#00221A] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669] transition-all"
                  placeholder="name@company.com"
                />
              </div>
              
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-bold text-[#00221A]">Password</label>
                  <a href="#" className="text-sm font-bold text-[#059669] hover:text-[#002E23] transition-colors">Forgot?</a>
                </div>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3.5 bg-[#FAFAFA] border border-[#EAEAEA] rounded-xl text-[#00221A] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669] transition-all"
                  placeholder="••••••••"
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-[#002E23] hover:bg-[#00392C] text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 mt-4"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
            
            <div className="mt-8 text-center text-sm font-medium text-[#4A6B5D]">
              Don't have an account? <Link to="/signup" className="text-[#059669] hover:text-[#002E23] transition-colors ml-1 font-bold">Start free trial</Link>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Brand Graphic (Hidden on Mobile) */}
      <div className="hidden lg:flex w-1/2 bg-[#002E23] flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
        <div className="relative z-10 flex justify-end">
          <LinkedLogo isWhite />
        </div>
        <div className="relative z-10 max-w-md ml-auto text-right">
          <h1 className="text-4xl font-bold text-white mb-6">Welcome back to scale.</h1>
          <p className="text-lg text-[#A7C7B9] leading-relaxed">
            Your AI agents have been busy resolving queries while you were away. Let's see how much time they saved you today.
          </p>
        </div>
        <div className="relative z-10 flex justify-end">
          <div className="bg-[#00392C] px-6 py-4 rounded-2xl border border-white/10 shadow-xl inline-flex items-center gap-4">
            <div className="w-12 h-12 bg-[#059669]/20 text-[#059669] rounded-xl flex items-center justify-center text-xl">🤖</div>
            <div className="text-left">
              <div className="text-white font-bold">1,248</div>
              <div className="text-xs text-[#A7C7B9] font-medium uppercase tracking-wider">Queries resolved today</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
