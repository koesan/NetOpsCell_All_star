import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { useRealtimeNotifications } from "../../hooks/useRealtimeNotifications";

export function AppShell() {
  useRealtimeNotifications();

  return (
    <div className="flex h-screen flex-col bg-surface-subtle lg:flex-row">
      <MobileNav />
      <Sidebar />
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
