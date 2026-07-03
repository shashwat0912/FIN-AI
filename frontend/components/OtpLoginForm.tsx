import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { tokenRefreshService } from '../services/tokenRefreshService';

type Step = 'identifier' | 'otp';

const trustItems = [
  'Secure OTP verification',
  'Your financial data is never sold',
  'You stay in control of AI recommendations',
];

export default function OtpLoginForm() {
  const [step, setStep] = useState<Step>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [identifierType, setIdentifierType] = useState<'email' | 'phone' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes in seconds
  const [isNewUser, setIsNewUser] = useState(false);
  const [otpForDev, setOtpForDev] = useState<string | null>(null);

  // Clear any existing error when component mounts
  useEffect(() => {
    tokenRefreshService.stopBackgroundRefresh();
    setError(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }, []);

  // Countdown timer for OTP expiry
  useEffect(() => {
    if (otpSent && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [otpSent, timeRemaining]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await apiClient.sendOtp(identifier);
      setIdentifierType(response.type);
      setIdentifier(response.identifier); // use normalized identifier for verify
      setIsNewUser(response.requiresName ?? false);
      setOtpForDev(response.otpForDev ?? null);
      if (response.otpForDev) setOtp(response.otpForDev); // auto-fill in dev
      setOtpSent(true);
      setStep('otp');
      setTimeRemaining(response.expiresIn);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate: if new user, name is required
      if (isNewUser && !name?.trim()) {
        setError('Please enter your name to create an account');
        setLoading(false);
        return;
      }

      // If it's a new user and name is required, pass it
      const nameToSend = isNewUser && name ? name.trim() : undefined;
      await apiClient.verifyOtp(identifier, otp, nameToSend);
      // Reload page to trigger authentication check
      window.location.reload();
    } catch (error: any) {
      setError(error.message);
      // If error mentions name is required, show name field (fallback)
      if (error.message.includes('Name is required')) {
        setIsNewUser(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setOtp('');
    setError(null);
    setLoading(true);

    try {
      const response = await apiClient.sendOtp(identifier);
      setTimeRemaining(response.expiresIn);
      setOtpForDev(response.otpForDev ?? null);
      if (response.otpForDev) setOtp(response.otpForDev);
      setError(null);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('identifier');
    setOtp('');
    setName('');
    setOtpSent(false);
    setIsNewUser(false);
    setOtpForDev(null);
    setError(null);
  };

  const identifierLabel = identifierType === 'phone' ? 'phone' : 'email';

  return (
    <div className="landing-page relative min-h-screen overflow-hidden bg-[#09090b] text-white antialiased">
      <div className="bg-radial-emerald absolute inset-0" />
      <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_72%_60%_at_50%_0%,#000_22%,transparent_76%)]" />

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 gap-10 px-6 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
        <section className="flex flex-col justify-between gap-10 lg:min-h-[calc(100vh-4rem)]">
          <a href="/" className="flex w-fit items-center gap-2 rounded-full text-white focus-visible:outline-none">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-emerald-500 text-zinc-950">
              <span className="font-display text-sm font-bold">F</span>
            </span>
            <span className="font-display text-base font-semibold tracking-tight">FinanceAI</span>
          </a>

          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-300 backdrop-blur">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Private access to your financial copilot</span>
            </div>

            <h1 className="font-display mt-8 text-balance text-4xl font-semibold leading-[1.04] tracking-tighter text-white sm:text-5xl lg:text-6xl">
              Continue with confidence.
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg">
              FinanceAI uses secure one-time verification so your money context stays protected from the first step.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:max-w-xl">
              {trustItems.map((item) => (
                <div key={item} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
                  <CheckCircle2 size={17} className="text-emerald-400" />
                  <p className="mt-3 text-sm leading-relaxed text-zinc-300">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden max-w-xl rounded-2xl border border-white/[0.06] bg-zinc-950/70 p-5 shadow-2xl shadow-emerald-950/20 backdrop-blur lg:block">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
              <div>
                <p className="text-xs text-zinc-500">Private copilot preview</p>
                <p className="font-display mt-1 text-sm font-medium tracking-tight text-white">Ready after verification</p>
              </div>
              <div className="rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-1 text-xs text-emerald-300">
                OTP secured
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                ['Spend signal', 'Private'],
                ['Budget view', 'Locked'],
                ['AI advice', 'User controlled'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                  <p className="text-[11px] text-zinc-500">{label}</p>
                  <p className="mt-2 text-sm font-medium text-zinc-200">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
              <div className="flex items-start gap-3">
                <Sparkles size={17} className="mt-0.5 shrink-0 text-emerald-300" />
                <p className="text-sm leading-relaxed text-zinc-300">
                  Your dashboard opens only after verification. Recommendations stay explainable, editable, and under your control.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center lg:justify-end">
          <div className="w-full max-w-[460px] rounded-2xl border border-white/[0.08] bg-zinc-950/88 p-5 shadow-2xl shadow-black/40 backdrop-blur sm:p-7">
            <div className="mb-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300">
                <LockKeyhole size={20} strokeWidth={1.8} />
              </div>
              <h2 className="font-display mt-5 text-2xl font-semibold tracking-tight text-white">
                {step === 'identifier' ? 'Sign in securely' : 'Enter your verification code'}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {step === 'identifier'
                  ? 'Use your email or Indian phone number. No password needed.'
                  : `We sent a 4-digit code to your ${identifierLabel}.`}
              </p>
            </div>

            {/* Step 1: Enter Identifier */}
            {step === 'identifier' && (
              <form className="space-y-5" onSubmit={handleSendOtp}>
                <div>
                  <label htmlFor="identifier" className="block text-sm font-medium text-zinc-200">
                    Email or phone number
                  </label>
                  <div className="mt-2 flex items-center rounded-xl border border-white/[0.10] bg-white/[0.03] px-3 transition-colors focus-within:border-emerald-400/70 focus-within:ring-4 focus-within:ring-emerald-500/10">
                    <div className="flex items-center gap-1.5 text-zinc-500">
                      <Mail size={16} />
                      <Smartphone size={15} />
                    </div>
                    <input
                      id="identifier"
                      name="identifier"
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="min-h-12 w-full bg-transparent px-3 text-sm text-white outline-none placeholder:text-zinc-600"
                      placeholder="email@example.com or 9876543210"
                    />
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                    Email or a 10-digit Indian mobile number works here.
                  </p>
                </div>

                {error && (
                  <div className="flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/10 p-4">
                    <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-300" />
                    <p className="text-sm font-medium leading-relaxed text-red-200">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 text-sm font-medium text-zinc-950 transition duration-150 hover:bg-emerald-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
                >
                  {loading ? (
                    <>
                      <Loader2 size={17} className="animate-spin" />
                      Sending code
                    </>
                  ) : (
                    <>
                      Send secure code
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Step 2: Verify OTP */}
            {step === 'otp' && (
              <form className="space-y-5" onSubmit={handleVerifyOtp}>
                <div>
                  <label htmlFor="otp" className="block text-sm font-medium text-zinc-200">
                    4-digit code
                  </label>
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    maxLength={4}
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="mt-2 min-h-14 w-full rounded-xl border border-white/[0.10] bg-white/[0.03] px-4 text-center font-mono text-2xl tracking-[0.35em] text-white outline-none transition-colors placeholder:text-zinc-700 focus:border-emerald-400/70 focus:ring-4 focus:ring-emerald-500/10"
                    placeholder="0000"
                    autoFocus
                  />
                  {/* Show OTP in dev so you can see it. SMS/email are simulated. */}
                  {otpForDev && (
                    <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3">
                      <p className="text-xs font-medium text-amber-100">Development code. Not sent by SMS or email.</p>
                      <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-amber-50">{otpForDev}</p>
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-zinc-500">
                      <Clock3 size={14} />
                      Valid for <span className="font-mono font-semibold text-zinc-300">{formatTime(timeRemaining)}</span>
                    </span>
                    {timeRemaining > 0 ? (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-medium text-emerald-300 transition-colors hover:bg-emerald-500/10 hover:text-emerald-200 disabled:opacity-50"
                      >
                        <RefreshCw size={13} />
                        Resend
                      </button>
                    ) : (
                      <span className="font-medium text-red-300">Code expired</span>
                    )}
                  </div>
                </div>

                {isNewUser && (
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-zinc-200">
                      Your name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-2 min-h-12 w-full rounded-xl border border-white/[0.10] bg-white/[0.03] px-4 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-400/70 focus:ring-4 focus:ring-emerald-500/10"
                      placeholder="Enter your full name"
                    />
                    <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                      We need this once to create your FinanceAI account.
                    </p>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/10 p-4">
                    <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-300" />
                    <p className="text-sm font-medium leading-relaxed text-red-200">{error}</p>
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={loading || timeRemaining <= 0}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 text-sm font-medium text-zinc-950 transition duration-150 hover:bg-emerald-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={17} className="animate-spin" />
                        Verifying
                      </>
                    ) : (
                      <>
                        Verify and continue
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={loading}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-white/[0.12] px-6 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ArrowLeft size={16} />
                    Back
                  </button>
                </div>
              </form>
            )}

            <div className="mt-7 rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-zinc-200">Secure OTP verification</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    No password to store. Codes expire quickly, and you can resend when needed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
