import {
  Activity,
  Brain,
  FolderOpen,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useAppearanceStore } from "@/store/appearance/appearance.store";
import { useConversationStore } from "@/store/conversations/conversation.store";

import { SidebarConversations } from "./SidebarConversations";
import { SidebarNavItem } from "./SidebarNavItem";

const navItems = [
  { to: "/chats", label: "Chats", icon: MessageSquare },
  { to: "/files", label: "Files", icon: FolderOpen },
  { to: "/memory", label: "Memory", icon: Brain },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/privacy", label: "Privacy", icon: ShieldCheck },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const navigate = useNavigate();
  const startNew = useConversationStore((state) => state.startNew);
  const collapsed = useAppearanceStore((state) => state.sidebarCollapsed);
  const updateSidebar = useAppearanceStore((state) => state.updateSidebar);

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
        collapsed ? "w-[4.25rem]" : "w-64",
      )}
    >
      <div className={cn("flex items-center gap-2 p-3", collapsed && "flex-col")}>
        <Button
          variant="outline"
          className={cn(
            "gap-2 rounded-xl border-border/70 bg-transparent text-sm font-medium hover:bg-sidebar-accent",
            collapsed ? "w-10 px-0 justify-center" : "flex-1 justify-start",
          )}
          onClick={() => {
            startNew();
            navigate("/chat");
          }}
          title={collapsed ? "New Chat" : undefined}
        >
          <Plus className="h-4 w-4" />
          {!collapsed && "New Chat"}
        </Button>
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => updateSidebar(collapsed ? "expanded" : "collapsed")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="space-y-1 px-3 pb-2">
        {navItems.map((item) => (
          <SidebarNavItem key={item.to} {...item} collapsed={collapsed} />
        ))}
      </nav>

      {!collapsed && (
        <>
          <div className="px-3 pb-2">
            <Separator className="bg-sidebar-border" />
          </div>
          <SidebarConversations />
        </>
      )}

      <div className={cn("mt-auto p-3", collapsed && "flex justify-center")}>
        {!collapsed && <Separator className="mb-3 bg-sidebar-border" />}
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl transition-colors hover:bg-sidebar-accent",
            collapsed ? "p-1" : "px-2 py-2",
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 text-xs font-semibold text-white">
            A
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-sidebar-foreground">Asit</p>
              <p className="truncate text-xs text-muted-foreground">Free plan</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
