import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/log/menu', label: 'Log from Menu' },
  { to: '/log/photo', label: 'Log Photo' },
  { to: '/history', label: 'History' },
  { to: '/settings', label: 'Settings' },
];

function linkClass({ isActive }: { isActive: boolean }): string {
  return `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-amber-400 text-black'
      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
  }`;
}

export function NavBar() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <span className="text-lg font-bold tracking-tight text-white">
          🐝 BuzzPlate
        </span>
        <nav className="flex flex-wrap items-center gap-1">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass} end={l.to === '/'}>
              {l.label}
            </NavLink>
          ))}
          <button
            onClick={() => supabase.auth.signOut()}
            className="ml-1 rounded-full px-3 py-1.5 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
