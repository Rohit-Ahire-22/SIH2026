import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, CheckCircle, Lock, Mail, ShieldCheck, User } from 'lucide-react';
import { API_URL } from '../config';
import PublicLayout from '../layouts/PublicLayout';

function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);

  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin h-12 w-12 rounded-full border-b-2 border-emerald-700"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setError('Please enter your full name.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: trimmedName, email: trimmedEmail, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed. Please try again.');
      }

      setRegistered(true);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (registered) {
    return (
      <PublicLayout>
        <div className="mx-auto w-full max-w-md py-12">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle size={28} />
            </div>
            <h2 className="text-2xl font-bold text-emerald-900">Account created</h2>
            <p className="mt-2 text-sm text-emerald-800">
              Your account is ready. Sign in to start an inspection.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
              >
                Sign in
              </Link>
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-md py-12">
        <div className="flex justify-center text-emerald-700">
          <ShieldCheck size={48} />
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold text-slate-900">Create your account</h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Join the inspection portal to start compliance assessments.
        </p>

        <div className="mt-8 rounded-lg border border-slate-200 bg-white px-8 py-8 shadow">
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
              <AlertCircle className="mt-0.5 shrink-0" size={18} />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                Full name
              </label>
              <div className="relative mt-1 rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Inspector name"
                  className="block w-full rounded-md border border-slate-300 py-2 pl-10 pr-3 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email address
              </label>
              <div className="relative mt-1 rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="inspector@example.com"
                  className="block w-full rounded-md border border-slate-300 py-2 pl-10 pr-3 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative mt-1 rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="block w-full rounded-md border border-slate-300 py-2 pl-10 pr-3 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 sm:text-sm"
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">At least 8 characters.</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
                Confirm password
              </label>
              <div className="relative mt-1 rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="block w-full rounded-md border border-slate-300 py-2 pl-10 pr-3 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 sm:text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex w-full justify-center rounded-md border border-transparent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                isSubmitting
                  ? 'cursor-not-allowed bg-emerald-600 opacity-75'
                  : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-emerald-700 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}

export default RegisterPage;