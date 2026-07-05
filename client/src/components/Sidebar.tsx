import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  ListChecks,
  Boxes,
  Truck,
  Receipt,
  FileText,
  ClipboardList,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const NAV_SECTIONS: { label: string; items: { to: string; label: string; icon: typeof LayoutDashboard }[] }[] = [
  {
    label: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Operations',
    items: [
      { to: '/projects', label: 'Projects', icon: FolderKanban },
      { to: '/employees', label: 'Employees', icon: Users },
      { to: '/tasks', label: 'Tasks', icon: ListChecks },
      { to: '/materials', label: 'Materials', icon: Boxes },
      { to: '/vendors', label: 'Vendors', icon: Truck },
      { to: '/daily-reports', label: 'Daily Reports', icon: ClipboardList },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/expenses', label: 'Expenses', icon: Receipt },
      { to: '/invoices', label: 'Invoices', icon: FileText },
    ],
  },
  {
    label: 'Insights',
    items: [{ to: '/reports', label: 'Analytics', icon: BarChart3 }],
  },
];

const ADMIN_SECTION = {
  label: 'Admin',
  items: [{ to: '/users', label: 'Users', icon: ShieldCheck }],
};

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-shell-active text-white shadow-sm' : 'text-white/70 hover:bg-shell-hover hover:text-white'
  }`;

export default function Sidebar() {
  const { user } = useAuth();
  const sections = user?.role === 'super_admin' ? [...NAV_SECTIONS, ADMIN_SECTION] : NAV_SECTIONS;

  return (
    <nav className="hidden w-60 shrink-0 flex-col gap-5 bg-shell p-4 sm:flex">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/40">
            {section.label}
          </p>
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass}>
                <item.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
