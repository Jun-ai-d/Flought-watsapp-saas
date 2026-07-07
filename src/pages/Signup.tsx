import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { LinkedLogo } from '../components/Logo';
import { Link } from 'react-router-dom';

const Signup: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 1. Check if domain is eligible for another trial
    const { data: isEligible, error: rpcError } = await supabase.rpc('check_domain_eligibility', {
      p_email: email
    } as never);

    if (rpcError) {
      console.error(rpcError);
      setError("An error occurred during domain verification. Please try again.");
      setLoading(false);
      return;
    }

    if (!isEligible) {
      setError("A trial has already been started for this company domain. Please log into your existing account or contact sales to upgrade.");
      setLoading(false);
      return;
    }

    // 2. Proceed with signup
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          business_name: businessName
        }
      }
    });

    if (signUpError) {
      setError(signUpError.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  if (success) {
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

          <div className="glass-card rounded-[2rem] p-8 md:p-10 relative overflow-hidden group text-center">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
            <h2 className="text-2xl font-bold text-white tracking-tight mb-4 relative z-10">Check Your Email</h2>
            <p className="text-gray-400 font-medium text-sm mb-6 relative z-10">We've sent a verification link to {email}. Please click the link to activate your Flought account.</p>
            <p className="text-xs text-[#059669] font-bold uppercase tracking-wider relative z-10">Your workspace is being automatically provisioned.</p>
          </div>
        </motion.div>
      </div>
    );
  }

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
            <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Create your workspace</h1>
            <p className="text-gray-400 font-medium text-sm">Join the forward-thinking brands.</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-5 relative z-10">
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
              <label htmlFor="businessName" className="block text-xs font-bold text-gray-300 uppercase tracking-wider">Business Name</label>
              <input 
                type="text" 
                id="businessName" 
                placeholder="e.g. Acme Corp" 
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required 
                className="w-full p-4 bg-black/50 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-white/30 focus:bg-white/5 transition-all text-sm font-medium"
              />
            </div>

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
              <label htmlFor="password" className="block text-xs font-bold text-gray-300 uppercase tracking-wider">Password</label>
              <input 
                type="password" 
                id="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full p-4 bg-black/50 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-white/30 focus:bg-white/5 transition-all text-sm font-medium"
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full mt-2 relative group/btn bg-white hover:bg-gray-100 text-black font-bold py-4 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 overflow-hidden flex items-center justify-center gap-2"
            >
              <span className="relative z-10">{loading ? 'Creating workspace...' : 'Start Free Trial'}</span>
            </button>
          </form>
          
          <div className="mt-8 text-center text-sm font-medium text-gray-500 relative z-10">
            Already have an account? <Link to="/login" className="text-white hover:text-[#059669] transition-colors ml-1">Sign in here</Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Signup;
