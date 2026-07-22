import { NavLink } from "react-router-dom";
import { LogOut, Radio } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { NAV_CONFIG, ROLE_LABELS } from "./navConfig";
import { cn } from "../../lib/cn";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  if (!user) return null;
  const items = NAV_CONFIG[user.role];

  return (
    <div className="flex h-full flex-col bg-navy-950 text-white">
      <div className="flex items-center gap-2.5 px-6 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-yellow">
          <Radio className="h-5 w-5 text-navy-950" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight tracking-tight">NetOpsCell</p>
          <p className="text-[11px] leading-tight text-navy-300">Turkcell Şebeke Operasyonu</p>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-3">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-white/10 text-white" : "text-navy-200 hover:bg-white/5 hover:text-white"
              )
            }
          >
            <item.icon className="h-[18px] w-[18px]" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-yellow text-xs font-bold text-navy-950">
            {(user.name?.[0] ?? user.email?.[0] ?? "K").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{user.name ? `${user.name} ${user.surname ?? ""}` : user.email || user.gsm}</p>
            <p className="truncate text-[11px] text-navy-300">{ROLE_LABELS[user.role]}</p>
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-navy-300 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Çıkış Yap
        </button>
      </div>
    </div>
  );
}
