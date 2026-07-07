import React, { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowRight } from 'lucide-react';
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
    <div className="min-h-screen bg-black flex items-center justify-center p-6 font-sans relative overflow-hidden selection:bg-white/20 selection:text-white">
      
      {/* 21st.dev Ambient Lights */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#8B5CF6]/15 blur-[120px] mix-blend-screen opacity-80 animate-[pulse_10s_ease-in-out_infinite]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-[#059669]/15 blur-[120px] mix-blend-screen opacity-60 animate-[pulse_12s_ease-in-out_infinite_reverse]"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[420px]"
      >
        <div className="flex justify-center mb-10">
          <LinkedLogo isWhite />
        </div>

        {/* Aceternity Glass Card */}
        <div className="glass-card rounded-[2rem] p-8 md:p-10 relative overflow-hidden group hover:border-white/20 transition-all duration-500">
          {/* Edge glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
          
          <div className="mb-8 text-center relative z-10">
            <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Welcome back</h1>
            <p className="text-gray-400 font-medium text-sm">Enter your credentials to continue.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5 relative z-10">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-2"
              >
                <span>⚠️</span> {error}
              </motion.div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="block text-xs font-bold text-gray-300 uppercase tracking-wider">Email</label>
              <input 
                type="email" 
                id="email" 
                placeholder="name@company.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
                className="w-full p-4 bg-black/50 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-white/30 focus:bg-white/5 transition-all text-sm font-medium"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="block text-xs font-bold text-gray-300 uppercase tracking-wider">Password</label>
                <a href="#" className="text-xs font-medium text-gray-500 hover:text-white transition-colors">Forgot?</a>
              </div>
              <input 
                type="password" 
                id="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                className="w-full p-4 bg-black/50 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-white/30 focus:bg-white/5 transition-all text-sm font-medium"
              />
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full flex items-center justify-center gap-2 p-4 mt-2 bg-white text-black font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 group text-sm shadow-[0_0_20px_rgba(255,255,255,0.15)]"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
              {!loading && <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>
          
          <div className="mt-8 pt-6 border-t border-white/10 text-center relative z-10">
            <p className="text-gray-500 text-xs font-medium">
              Don't have an account? <Link to="/signup" className="text-white hover:text-gray-300 transition-colors font-bold ml-1">Request access</Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
