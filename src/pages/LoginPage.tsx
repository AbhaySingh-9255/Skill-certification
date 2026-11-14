import React, { useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/Button';

export const LoginPage = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'register') {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      navigate('/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const isRegistering = mode === 'register';

  return (
    <div className="min-h-screen bg-slateBg">
      <header className="flex h-[68px] items-center justify-between border-b border-white/10 bg-[#194638] px-5 text-white sm:px-8 lg:px-12">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/10">
            <BookOpen size={19} aria-hidden="true" />
          </span>
          <span className="text-sm font-bold tracking-wide sm:text-base">SKILLCERT PRO</span>
        </div>
        <span className="text-xs font-medium text-white/75 sm:text-sm">
          {isRegistering ? 'STUDENT ACCOUNT' : 'SECURE SIGN IN'}
        </span>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh_-_68px)] max-w-[1440px] md:grid-cols-2">
        <section className="relative flex min-h-[300px] flex-col justify-center overflow-hidden bg-[#245B4A] px-6 py-10 text-white sm:px-10 md:min-h-full md:px-10 lg:px-14 xl:px-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full border border-white/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-48 -left-36 h-[34rem] w-[34rem] rounded-full border border-white/10"
          />
          <div className="relative max-w-xl">
            <h1 className="mt-3 max-w-lg text-5xl font-extrabold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl xl:text-[5.5rem]">
              {isRegistering ? (
                <>LEARN<br />WITH PURPOSE.</>
              ) : (
                <>WELCOME<br />BACK.</>
              )}
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/80 sm:text-base">
              {isRegistering
                ? 'Create your account to build skills, practice with purpose, and track your progress.'
                : 'Sign in to continue practicing, build confidence, and keep moving toward your goals.'}
            </p>
            <div className="mt-8 hidden items-center gap-3 text-sm text-white/85 sm:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10">
                <CheckCircle2 size={16} aria-hidden="true" />
              </span>
              <span>Practice, improve, and celebrate every milestone.</span>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-[#F6F5F0] px-5 py-10 sm:px-10 sm:py-14 lg:px-12 xl:px-20">
          <div className="flex min-h-[480px] w-full max-w-[520px] flex-col justify-between rounded-2xl border border-[#D8DED8] bg-white px-6 py-8 sm:min-h-[560px] sm:px-10 sm:py-10 lg:px-12">
            <div>
              <div className="mb-9">
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#202B28] sm:text-4xl">
                  {isRegistering ? 'Create account' : 'Sign in'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {isRegistering && (
                  <div>
                    <label htmlFor="login-name" className="mb-2 block text-sm font-semibold text-[#202B28]">
                      Name
                    </label>
                    <input
                      id="login-name"
                      type="text"
                      autoComplete="name"
                      required
                      maxLength={120}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Your name"
                      className="min-h-12 w-full rounded-lg border border-[#D8DED8] bg-white px-4 text-sm text-[#202B28] outline-none transition-colors placeholder:text-[#7B8780] hover:border-[#9EAEA4] focus:border-[#245B4A] focus:ring-2 focus:ring-[#245B4A]/15"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="login-email" className="mb-2 block text-sm font-semibold text-[#202B28]">
                    Email address
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="min-h-12 w-full rounded-lg border border-[#D8DED8] bg-white px-4 text-sm text-[#202B28] outline-none transition-colors placeholder:text-[#7B8780] hover:border-[#9EAEA4] focus:border-[#245B4A] focus:ring-2 focus:ring-[#245B4A]/15"
                  />
                </div>

                <div>
                  <label htmlFor="login-password" className="mb-2 block text-sm font-semibold text-[#202B28]">
                    Password
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    autoComplete={isRegistering ? 'new-password' : 'current-password'}
                    required
                    minLength={isRegistering ? 12 : 1}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={isRegistering ? 'At least 12 characters' : 'Enter your password'}
                    className="min-h-12 w-full rounded-lg border border-[#D8DED8] bg-white px-4 text-sm text-[#202B28] outline-none transition-colors placeholder:text-[#7B8780] hover:border-[#9EAEA4] focus:border-[#245B4A] focus:ring-2 focus:ring-[#245B4A]/15"
                  />
                </div>

                {error && (
                  <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  isLoading={loading}
                  className="min-h-12 w-full justify-between rounded-lg px-4"
                >
                  <span>{loading ? (isRegistering ? 'Creating account…' : 'Signing in…') : (isRegistering ? 'Create account' : 'Sign in')}</span>
                  {!loading && <ArrowRight size={17} aria-hidden="true" />}
                </Button>
              </form>
            </div>

            <div className="mt-10 border-t border-[#D8DED8] pt-5">
              <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[#5E6B65]">
                  {isRegistering ? 'Already have an account?' : 'Don’t have an account?'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMode(isRegistering ? 'login' : 'register');
                    setError('');
                  }}
                  className="inline-flex items-center gap-1 self-start font-semibold text-[#245B4A] underline-offset-4 transition-colors hover:text-[#194638] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245B4A] sm:self-auto"
                >
                  {isRegistering ? 'Sign in' : 'Create an account'}
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
