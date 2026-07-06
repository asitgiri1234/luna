import { Brain, MessageSquare, Plus, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { SidebarNavItem } from "./SidebarNavItem";

const navItems = [
  { to: "/chats", label: "Chats", icon: MessageSquare },
  { to: "/memory", label: "Memory", icon: Brain },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const navigate = useNavigate();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="p-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 rounded-xl border-border/70 bg-transparent text-sm font-medium hover:bg-sidebar-accent"
          onClick={() => navigate("/chat")}
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-1">
        {navItems.map((item) => (
          <SidebarNavItem key={item.to} {...item} />
        ))}
      </nav>

      <div className="p-3">
        <Separator className="mb-3 bg-sidebar-border" />
        <div className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-sidebar-accent">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 text-xs font-semibold text-white">
            A
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-sidebar-foreground">Asit</p>
            <p className="truncate text-xs text-muted-foreground">Free plan</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
