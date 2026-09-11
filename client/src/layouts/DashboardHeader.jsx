import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, FileText, MapPin, Scan } from 'lucide-react';

function DashboardHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-slate-300 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded bg-emerald-700 text-lg font-bold text-white">
            LM
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight text-slate-800">
              Packaged Commodity Compliance System
            </p>
            <p className="text-xs text-slate-500">SIH26034</p>
          </div>
        </Link>
        <nav className="flex items-center gap-2 text-sm text-slate-600">
          <span className="hidden rounded-full border border-emerald-600 bg-emerald-50 px-3 py-1 font-medium text-emerald-700 sm:block">
            Legal Metrology
          </span>

          {/* Feature nav links */}
          <Link
            to="/complaints"
            className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            title="My Complaints"
          >
            <FileText size={14} /> Complaints
          </Link>
          <Link
            to="/violations/map"
            className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            title="Violation Intelligence Map"
          >
            <MapPin size={14} /> Map
          </Link>
          <Link
            to="/nutrition"
            className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            title="Nutrition Scanner"
          >
            <Scan size={14} /> Nutrition
          </Link>
          
          {user && (
            <div className="flex items-center gap-3 border-l pl-3 ml-1 border-slate-200">
              <div className="hidden sm:flex flex-col items-end">
                <span className="font-semibold text-slate-800 leading-tight">{user.name}</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{user.role}</span>
              </div>
              <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 sm:hidden">
                <User size={16} />
              </div>
              <button 
                onClick={logout}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}

export default DashboardHeader

