import { Link } from 'react-router-dom';

function PublicHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded bg-emerald-700 text-lg font-bold text-white">
            LM
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight text-slate-800">
              Packaged Commodity Compliance Intelligence
            </p>
            <p className="text-xs text-slate-500">SIH26034</p>
          </div>
        </Link>
        <nav className="flex items-center gap-2 text-sm sm:gap-3">
          <Link
            to="/login"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white shadow-sm transition-colors hover:bg-emerald-800"
          >
            Create Account
          </Link>
        </nav>
      </div>
    </header>
  );
}

function PublicFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
          <p className="text-sm text-slate-500">
            SIH 2026 &middot; Packaged Commodity Compliance Intelligence
          </p>
          <p className="text-xs text-slate-400">
            AI-assisted compliance assessment platform &mdash; not a legal determination.
          </p>
        </div>
      </div>
    </footer>
  );
}

function PublicLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800">
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}

export default PublicLayout;