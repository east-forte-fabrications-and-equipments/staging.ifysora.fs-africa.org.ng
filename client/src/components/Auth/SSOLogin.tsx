import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SSOLogin() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Authenticating with Google...');

  useEffect(() => {
    const handleSSOCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      const state = searchParams.get('state');

      if (error) {
        setStatus('error');
        setMessage('Google authentication failed. Please try again.');
        toast.error('Authentication failed');
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      if (!code) {
        setStatus('error');
        setMessage('No authorization code received.');
        toast.error('Authentication failed');
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      try {
        // Exchange code for tokens via backend
        const response = await fetch(`/api/auth/google/callback?code=${code}&state=${state}`, {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to exchange authorization code');
        }

        // Refresh user session
        await refreshUser();
        
        setStatus('success');
        setMessage('Authentication successful! Redirecting...');
        toast.success('Welcome!');
        
        setTimeout(() => navigate('/dashboard'), 1500);
        
      } catch (error: any) {
        console.error('SSO callback error:', error);
        setStatus('error');
        setMessage(error.message || 'Authentication failed. Please try again.');
        toast.error('Authentication failed');
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleSSOCallback();
  }, [searchParams, navigate, refreshUser]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden p-8">
        <div className="text-center space-y-6">
          {status === 'loading' && (
            <>
              <div className="inline-flex p-4 bg-indigo-50 rounded-full">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Authenticating</h3>
              <p className="text-sm text-slate-500">{message}</p>
              <div className="flex justify-center gap-1">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="inline-flex p-4 bg-green-50 rounded-full">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Success!</h3>
              <p className="text-sm text-slate-500">{message}</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="inline-flex p-4 bg-red-50 rounded-full">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Authentication Failed</h3>
              <p className="text-sm text-slate-500">{message}</p>
              <button
                onClick={() => navigate('/login')}
                className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-xl transition"
              >
                Back to Login
              </button>
            </>
          )}
        </div>

        <div className="text-center text-[10px] text-slate-400 border-t border-slate-200 pt-4 mt-6">
          <p>Part of the <span className="font-semibold">FYSORA Ecosystem</span></p>
        </div>
      </div>
    </div>
  );
              }
