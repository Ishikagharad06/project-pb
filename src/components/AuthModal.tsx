import React, { useState } from 'react';
import { X, User, Mail, Lock, Phone, CheckCircle2, UserPlus, LogIn, Sparkles, LogOut } from 'lucide-react';
import { UserAccount, UserRole } from '../types.js';
import { API_BASE_URL } from '../apiConfig.js';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserAccount) => void;
  onLogout?: () => void;
  currentUser?: UserAccount | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onLogout,
  currentUser
}) => {
  const [isSignUp, setIsSignUp] = useState<boolean>(true);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [role, setRole] = useState<UserRole>('user');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Google Sign-In state
  const [showGooglePrompt, setShowGooglePrompt] = useState<boolean>(false);
  const [customGmail, setCustomGmail] = useState<string>('keshavgupta5060@gmail.com');
  const [googleName, setGoogleName] = useState<string>('Keshav Gupta');

  if (!isOpen) return null;

  const handleGoogleSignIn = async (selectedEmail: string, selectedName?: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedEmail || !selectedEmail.includes('@')) {
      setErrorMsg('Please enter a valid Gmail address.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: selectedEmail.trim(),
          name: selectedName || selectedEmail.split('@')[0],
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(selectedEmail)}`
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.reason || 'Google Authentication failed');
      }

      setSuccessMsg(data.message || `Signed in as ${data.user.email}!`);
      setShowGooglePrompt(false);

      setTimeout(() => {
        onSuccess(data.user);
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    if (isSignUp && !name) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    try {
      setIsLoading(true);
      const endpoint = isSignUp ? '/api/auth/signup' : '/api/auth/login';
      const body = isSignUp
        ? { name, email, password, role, phone }
        : { email, password };

      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.reason || 'Authentication failed');
      }

      setSuccessMsg(isSignUp ? 'Account created and saved to database! Welcome to ParkBy.' : 'Signed in successfully!');
      setTimeout(() => {
        onSuccess(data.user);
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#131b2e] border border-white/20 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#1a3d8f] rounded-xl text-[#66daba]">
              {isSignUp ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {currentUser ? 'Account Settings' : isSignUp ? 'Create ParkBy Account' : 'Welcome Back'}
              </h3>
              <p className="text-xs text-[#bccac3]">
                {currentUser
                  ? `Signed in as ${currentUser.email}`
                  : isSignUp
                  ? 'Join ParkBy with Gmail or Email'
                  : 'Sign in to access your active bookings & wallet'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg text-[#bccac3] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="bg-[#66daba]/20 border border-[#66daba] text-[#66daba] p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-pulse">
            <CheckCircle2 className="w-4 h-4 text-[#66daba] shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="bg-red-500/20 border border-red-500/40 text-red-300 p-3 rounded-xl text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {currentUser ? (
          <div className="space-y-4 py-2 text-center">
            <div className="p-4 bg-[#171f33] rounded-xl border border-white/10 space-y-2">
              <div className="text-sm font-bold text-white">{currentUser.name}</div>
              <div className="text-xs text-[#66daba] font-mono">{currentUser.email}</div>
              <div className="text-[10px] uppercase font-bold text-[#bccac3]">
                Role: {currentUser.role} • Wallet: ₹{currentUser.wallet_balance}
              </div>
            </div>

            {onLogout && (
              <button
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 font-bold text-xs uppercase py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Sign Out / Logout
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Google Sign-In Quick Action */}
            <div className="space-y-3">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setShowGooglePrompt(!showGooglePrompt)}
                className="w-full bg-white hover:bg-gray-100 text-gray-900 font-bold text-sm py-3 rounded-xl shadow-md transition-colors flex items-center justify-center gap-3 border border-gray-300"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google / Gmail</span>
              </button>

              {showGooglePrompt && (
                <div className="bg-[#171f33] p-4 rounded-xl border border-[#66daba]/40 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-[#66daba] flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> Sign in with Gmail
                    </span>
                    <span className="text-[10px] text-[#bccac3]">Auto-adds to Database</span>
                  </div>

                  {/* Quick One-Click Gmail preset for user */}
                  <button
                    type="button"
                    onClick={() => handleGoogleSignIn('keshavgupta5060@gmail.com', 'Keshav Gupta')}
                    className="w-full bg-[#0b1326] hover:bg-[#1a294d] border border-white/20 p-2.5 rounded-lg text-left transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">Keshav Gupta</div>
                      <div className="text-[11px] text-[#66daba]">keshavgupta5060@gmail.com</div>
                    </div>
                    <span className="text-[10px] bg-[#66daba] text-[#00382c] font-bold px-2 py-0.5 rounded">
                      One-Click
                    </span>
                  </button>

                  <div className="text-center text-[10px] text-[#bccac3] uppercase font-bold">Or enter custom Gmail</div>

                  <div className="space-y-2">
                    <input
                      type="email"
                      value={customGmail}
                      onChange={e => setCustomGmail(e.target.value)}
                      placeholder="your.email@gmail.com"
                      className="w-full bg-[#0b1326] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#66daba]"
                    />
                    <input
                      type="text"
                      value={googleName}
                      onChange={e => setGoogleName(e.target.value)}
                      placeholder="Your Name"
                      className="w-full bg-[#0b1326] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#66daba]"
                    />
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleGoogleSignIn(customGmail, googleName)}
                      className="w-full bg-[#66daba] text-[#00382c] font-bold text-xs uppercase py-2 rounded-lg hover:bg-[#84f7d5] transition-colors"
                    >
                      Authenticate with Gmail
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink mx-3 text-[10px] font-bold uppercase text-[#bccac3]">Or Email Credentials</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div>
                  <label className="block text-xs font-bold uppercase text-[#bccac3] mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#86948e] absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required={isSignUp}
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Keshav Gupta"
                      className="w-full bg-[#0b1326] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#66daba]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-[#bccac3] mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#86948e] absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="keshavgupta5060@gmail.com"
                    className="w-full bg-[#0b1326] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#66daba]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#bccac3] mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#86948e] absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#0b1326] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#66daba]"
                  />
                </div>
              </div>

              {isSignUp && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#bccac3] mb-1">
                      Phone Number (Optional)
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-[#86948e] absolute left-3.5 top-3" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+91-9876543210"
                        className="w-full bg-[#0b1326] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#66daba]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-[#bccac3] mb-1">
                      Account Type / Role
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRole('user')}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                          role === 'user'
                            ? 'bg-[#66daba] text-[#00382c] border-[#66daba]'
                            : 'bg-[#171f33] text-[#bccac3] border-white/10'
                        }`}
                      >
                        Driver / User
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('admin')}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                          role === 'admin'
                            ? 'bg-[#66daba] text-[#00382c] border-[#66daba]'
                            : 'bg-[#171f33] text-[#bccac3] border-white/10'
                        }`}
                      >
                        Parking Admin
                      </button>
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#66daba] text-[#00382c] font-bold text-sm uppercase py-3 rounded-xl hover:bg-[#84f7d5] transition-colors disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Sparkles className="w-4 h-4 animate-spin text-[#00382c]" />
                ) : isSignUp ? (
                  'Create Account & Get ₹500 Bonus'
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Toggle between Sign Up and Sign In */}
            <div className="text-center pt-2 border-t border-white/10">
              <p className="text-xs text-[#bccac3]">
                {isSignUp ? 'Already have an account?' : "Don't have an account yet?"}{' '}
                <button
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setErrorMsg(null);
                  }}
                  className="text-[#66daba] font-bold hover:underline ml-1"
                >
                  {isSignUp ? 'Sign In' : 'Sign Up Now'}
                </button>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
