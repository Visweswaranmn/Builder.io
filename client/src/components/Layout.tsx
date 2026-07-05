import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Building2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-shell-active text-white' : 'text-white/70 hover:bg-shell-hover hover:text-white'
  }`;

/** App shell. Dark top navigation + sidebar once logged in; same dark header (Home/Login links) otherwise. */
export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-shell shadow-sm">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold text-white">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 text-white">
              <Building2 className="h-4 w-4" strokeWidth={2.25} />
            </span>
            BUILDER.IO
          </Link>

          {user ? (
            <div className="flex items-center gap-3">
              <NotificationBell />
              <div className="flex items-center gap-3 border-l border-shell-border pl-3">
                <span className="text-sm text-white/70">
                  {user.name} <span className="text-white/30">·</span>{' '}
                  <span className="capitalize">{user.role.replace('_', ' ')}</span>
                </span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-shell-hover hover:text-white"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Log out
                </button>
              </div>
            </div>
          ) : (
            <nav className="flex items-center gap-1">
              <NavLink to="/" end className={navLinkClass}>
                Home
              </NavLink>
              <NavLink to="/login" className={navLinkClass}>
                Log in
              </NavLink>
            </nav>
          )}
        </div>
      </header>

      <div className="flex flex-1">
        {user && <Sidebar />}
        <main className="flex-1 bg-slate-50">
          <div className="mx-auto max-w-6xl px-6 py-8 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      <footer className="border-t border-slate-200 bg-panel">
        <div className="px-4 py-4 text-center text-xs text-ink-faint">
          BUILDER.IO
        </div>
      </footer>
    </div>
  );
}
