"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { ShieldAlert, LayoutDashboard, Bell, FileSearch, Users, LogOut, Activity, Map, Search, Radio } from "lucide-react";

const navByRole = {
  admin: [
    { href: "/dashboard/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/admin/alerts", label: "Alerts", icon: Bell },
    { href: "/dashboard/admin/incidents", label: "Incidents", icon: Activity },
    { href: "/dashboard/admin/logs", label: "Log Search", icon: Search },
    { href: "/dashboard/admin/map", label: "GeoIP Map", icon: Map },
    { href: "/dashboard/admin/users", label: "Users", icon: Users },
  ],
  analyst: [
    { href: "/dashboard/analyst", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/analyst/incidents", label: "Incidents", icon: Activity },
    { href: "/dashboard/analyst/logs", label: "Login Logs", icon: FileSearch },
  ],
  user: [
    { href: "/dashboard/user", label: "My Activity", icon: Activity },
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const nav = navByRole[user?.role] || [];

  const handleLogout = () => { logout(); router.replace("/login"); };

  return (
    <aside className="w-60 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
        <ShieldAlert className="w-7 h-7 text-cyan-400 shrink-0" />
        <span className="text-sm font-bold text-white leading-tight">Threat Detection</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                active ? "bg-cyan-600/20 text-cyan-400" : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-800">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm font-medium text-white truncate">{user?.name}</p>
          <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-red-400 transition"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </aside>
  );
}
