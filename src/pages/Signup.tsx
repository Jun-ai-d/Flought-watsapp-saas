import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white border-2 border-[#1A1A1A] p-8 shadow-[8px_8px_0px_0px_rgba(26,26,26,1)] text-center">
          <h2 className="text-3xl font-display font-bold text-[#1A1A1A] mb-4">Check Your Email</h2>
          <p className="text-[#666666] mb-6">We've sent a verification link to {email}. Please click the link to activate your Flought account.</p>
          <p className="text-sm text-gray-500">Your workspace is being automatically provisioned.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white border-2 border-[#1A1A1A] p-8 shadow-[8px_8px_0px_0px_rgba(26,26,26,1)]">
        
        <div className="text-center mb-8">
          <div className="text-3xl font-display font-black text-[#1A1A1A] tracking-tighter mb-2">FLOUGHT</div>
          <h2 className="text-xl font-bold text-[#666666]">Create your workspace</h2>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border-l-4 border-[#059669] text-[#059669] text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-[#1A1A1A] mb-1">Business Name</label>
            <input 
              type="text" 
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full p-3 border-2 border-[#E5E5E5] focus:border-[#1A1A1A] focus:outline-none transition-colors"
              placeholder="e.g. Acme Corp"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-[#1A1A1A] mb-1">Email address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border-2 border-[#E5E5E5] focus:border-[#1A1A1A] focus:outline-none transition-colors"
              placeholder="name@company.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-[#1A1A1A] mb-1">Password</label>
            <input 
              type="password" 
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border-2 border-[#E5E5E5] focus:border-[#1A1A1A] focus:outline-none transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#1A1A1A] text-white font-bold py-3 hover:bg-black transition-colors border-2 border-transparent hover:border-[#1A1A1A] disabled:opacity-50"
          >
            {loading ? 'Creating workspace...' : 'Sign up'}
          </button>
        </form>
        
        <div className="mt-6 text-center text-sm text-[#666666]">
          Already have an account? <a href="/login" className="text-[#059669] font-bold hover:underline">Sign in here</a>
        </div>
      </div>
    </div>
  );
};

export default Signup;
