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

    const { data: isEligible, error: rpcError } = await supabase.rpc('check_domain_eligibility', {
      p_email: email
    } as never);

    if (rpcError) {
      setError("An error occurred during domain verification. Please try again.");
      setLoading(false);
      return;
    }

    if (!isEligible) {
      setError("A trial has already been started for this company domain. Please log into your existing account or contact sales to upgrade.");
      setLoading(false);
      return;
    }

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

  return (
    <div className="min-h-screen flex bg-white font-sans selection:bg-[#002E23] selection:text-white">
      {/* Left Side - Brand Graphic (Hidden on Mobile) */}
      <div className="hidden lg:flex w-1/2 bg-[#002E23] flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
        <div className="relative z-10">
          <LinkedLogo isWhite />
        </div>
        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl font-bold text-white mb-6">Scale your operations instantly.</h1>
          <p className="text-lg text-[#A7C7B9] leading-relaxed">
            Join the forward-thinking brands running their customer support and sales on autopilot with Flought.
          </p>
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 text-white">
            <div className="flex -space-x-3">
              <div className="w-10 h-10 rounded-full border-2 border-[#002E23] bg-[#059669]"></div>
              <div className="w-10 h-10 rounded-full border-2 border-[#002E23] bg-[#C1440E]"></div>
              <div className="w-10 h-10 rounded-full border-2 border-[#002E23] bg-[#A7C7B9]"></div>
            </div>
            <div className="text-sm font-medium">Trusted by modern teams</div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
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
            {success ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-[#059669]/10 text-[#059669] rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">✓</div>
                <h2 className="text-2xl font-bold text-[#00221A] mb-3">Check Your Email</h2>
                <p className="text-[#4A6B5D] mb-6">We've sent a verification link to <span className="font-semibold">{email}</span>. Click it to activate your account.</p>
                <p className="text-xs text-[#059669] font-bold uppercase tracking-wider">Workspace automatically provisioning</p>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-[#00221A] mb-2">Create your workspace</h2>
                  <p className="text-[#4A6B5D]">Start your 14-day free trial. No credit card required.</p>
                </div>

                <form onSubmit={handleSignup} className="space-y-5">
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
                    <label className="block text-sm font-bold text-[#00221A]">Business Name</label>
                    <input 
                      type="text" 
                      required
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full p-3.5 bg-[#FAFAFA] border border-[#EAEAEA] rounded-xl text-[#00221A] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669] transition-all"
                      placeholder="e.g. Acme Corp"
                    />
                  </div>

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
                    <label className="block text-sm font-bold text-[#00221A]">Password</label>
                    <input 
                      type="password" 
                      required
                      minLength={6}
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
                    {loading ? 'Creating workspace...' : 'Start Free Trial'}
                  </button>
                </form>
                
                <div className="mt-8 text-center text-sm font-medium text-[#4A6B5D]">
                  Already have an account? <Link to="/login" className="text-[#059669] hover:text-[#002E23] transition-colors ml-1 font-bold">Sign in</Link>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
