"use client";

import { Sidebar } from "./Sidebar";
import { useSidebarStore } from "@/store/useSidebarStore";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const isCollapsed = useSidebarStore((state) => state.isCollapsed);

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div
        className={cn(
          "flex-1 flex flex-col h-screen transition-all duration-300 py-3 pr-3",
          isCollapsed ? "ml-[80px]" : "ml-[280px]",
        )}
      >
        <main className="flex-1 bg-surface rounded-2xl border border-line shadow-sm overflow-hidden flex flex-col relative">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            <div className="max-w-[1280px] w-full mx-auto h-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
