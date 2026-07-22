import { SidebarContent } from "./SidebarContent";

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-64 shrink-0 lg:block">
      <SidebarContent />
    </aside>
  );
}
