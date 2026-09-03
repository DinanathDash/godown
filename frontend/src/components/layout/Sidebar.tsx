"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Settings,
  Headphones,
  LogOut,
  Command,
  PanelLeftClose,
  LineChart,
  CreditCard,
  Receipt,
  ClipboardList,
  Folder,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useSidebarStore } from "@/store/useSidebarStore";
import { cn } from "@/lib/utils";
import Image from "next/image";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { hasPermission, type Permission } from "@/auth/permissions";

type NavItem = {
  title: string;
  href?: string;
  icon: LucideIcon;
  badge?: number;
  isDummy?: boolean;
  requiredPermission?: Permission;
  children?: {
    title: string;
    href: string;
    isDummy?: boolean;
    requiredPermission?: Permission;
  }[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Main",
    items: [
      {
        title: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
        badge: 2,
        requiredPermission: "VIEW_DASHBOARD",
      },
      {
        title: "Analytics",
        icon: LineChart,
        isDummy: true,
        children: [
          { title: "Overview", href: "#", isDummy: true },
          { title: "Reports", href: "#", isDummy: true },
          { title: "Insights", href: "#", isDummy: true },
        ],
      },
      { title: "Teams", href: "#", icon: Users, isDummy: true },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        title: "Customers",
        href: "/customers",
        icon: Users,
        requiredPermission: "VIEW_CUSTOMER",
      },
      {
        title: "Products",
        href: "/products",
        icon: Package,
        requiredPermission: "VIEW_PRODUCT",
      },
      {
        title: "Challans",
        href: "/challans",
        icon: FileText,
        requiredPermission: "VIEW_CHALLAN",
      },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "My cards", href: "#", icon: CreditCard, isDummy: true },
      { title: "Payments", href: "#", icon: Receipt, isDummy: true },
    ],
  },
  {
    label: "Work",
    items: [
      {
        title: "Tasks",
        href: "#",
        icon: ClipboardList,
        badge: 1,
        isDummy: true,
      },
      { title: "Files", href: "#", icon: Folder, isDummy: true },
    ],
  },
];

const bottomLinks = [
  { title: "Settings", href: "#", icon: Settings, isDummy: true },
  { title: "Support", href: "#", icon: Headphones, isDummy: true },
];

const getAvatarUrl = (name?: string, email?: string) => {
  const identifier = name || (email ? email.split(".")[0] : "User");
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(identifier)}&background=random`;
};

const SidebarTooltip = ({
  children,
  text,
  show,
}: {
  children: React.ReactElement;
  text?: string;
  show?: boolean;
}) => {
  if (!show || !text) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="right" sideOffset={10}>
        <p className="text-xs">{text}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { isCollapsed, toggleCollapse } = useSidebarStore();
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
    Analytics: true,
  });

  const toggleExpand = (title: string) => {
    setExpandedItems((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <div
      className={cn(
        "bg-canvas h-screen flex flex-col fixed left-0 top-0 overflow-hidden transition-all duration-300 z-50",
        isCollapsed ? "w-[80px]" : "w-[280px]",
      )}
    >
      {/* Brand Header */}
      <div className="h-[72px] flex items-center justify-between px-6 border-b border-line shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-ink rounded-lg flex shrink-0 items-center justify-center">
            <Command className="w-5 h-5 text-white" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col whitespace-nowrap opacity-100 transition-opacity duration-300">
              <span className="text-[15px] font-bold text-ink leading-tight">
                Counterfoil
              </span>
              <span className="text-[11px] text-muted-foreground font-medium leading-tight">
                ERP System
              </span>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <button
            onClick={toggleCollapse}
            className="text-muted-foreground hover:text-ink transition-colors"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {isCollapsed && (
        <div className="flex justify-center pt-4 shrink-0">
          <button
            onClick={toggleCollapse}
            className="text-muted-foreground hover:text-ink transition-colors"
          >
            <PanelLeftClose className="w-4 h-4 rotate-180" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 flex flex-col gap-6 custom-scrollbar">
        {navGroups.map((group) => (
          <div key={group.label} className="w-full">
            {!isCollapsed ? (
              <p className="text-[11px] font-medium text-muted-foreground mb-2 px-3 tracking-wide whitespace-nowrap">
                {group.label}
              </p>
            ) : (
              <div className="h-4"></div>
            )}

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isParentActive =
                  item.href === pathname ||
                  (item.href &&
                    item.href !== "/" &&
                    pathname.startsWith(item.href)) ||
                  item.children?.some((child) => child.href === pathname);

                const Icon = item.icon;
                const hasChildren = !!item.children;
                const isExpanded = expandedItems[item.title];

                if (
                  item.requiredPermission &&
                  user &&
                  !hasPermission(user.role, item.requiredPermission)
                ) {
                  return null;
                }

                const tooltipText = item.isDummy
                  ? "This is a dummy element."
                  : isCollapsed
                    ? item.title
                    : undefined;
                const showTooltip = item.isDummy || isCollapsed;

                return (
                  <div key={item.title}>
                    {hasChildren ? (
                      <SidebarTooltip show={showTooltip} text={tooltipText}>
                        <button
                          onClick={() => {
                            if (isCollapsed) toggleCollapse();
                            toggleExpand(item.title);
                          }}
                          className={cn(
                            "w-full flex items-center rounded-lg text-[13px] font-medium transition-all group",
                            isCollapsed
                              ? "justify-center px-0 py-2.5"
                              : "justify-between px-3 py-2.5",
                            "text-muted-foreground hover:bg-canvas hover:text-ink",
                          )}
                        >
                          <div className="flex items-center">
                            <Icon
                              className={cn(
                                "h-4 w-4 shrink-0 transition-colors text-muted-foreground group-hover:text-ink",
                                !isCollapsed && "mr-3",
                              )}
                            />
                            {!isCollapsed && (
                              <span className="whitespace-nowrap">
                                {item.title}
                              </span>
                            )}
                          </div>
                          {!isCollapsed && (
                            <ChevronDown
                              className={cn(
                                "w-4 h-4 transition-transform",
                                isExpanded ? "rotate-180" : "",
                              )}
                            />
                          )}
                        </button>
                      </SidebarTooltip>
                    ) : (
                      <SidebarTooltip show={showTooltip} text={tooltipText}>
                        <Link
                          href={item.href || "#"}
                          onClick={(e) => {
                            if (item.isDummy) e.preventDefault();
                          }}
                          className={cn(
                            "w-full flex items-center rounded-lg text-[13px] font-medium transition-all group",
                            isCollapsed
                              ? "justify-center px-0 py-2.5"
                              : "justify-between px-3 py-2.5",
                            isParentActive
                              ? "bg-ink text-white shadow-sm"
                              : "text-muted-foreground hover:bg-canvas hover:text-ink",
                          )}
                        >
                          <div className="flex items-center">
                            <Icon
                              className={cn(
                                "h-4 w-4 shrink-0 transition-colors",
                                !isCollapsed && "mr-3",
                                isParentActive
                                  ? "text-white"
                                  : "text-muted-foreground group-hover:text-ink",
                              )}
                            />
                            {!isCollapsed && (
                              <span className="whitespace-nowrap">
                                {item.title}
                              </span>
                            )}
                          </div>
                          {!isCollapsed && item.badge && (
                            <div className="w-4 h-4 bg-destructive text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                              {item.badge}
                            </div>
                          )}
                        </Link>
                      </SidebarTooltip>
                    )}

                    {/* Children */}
                    {hasChildren && isExpanded && !isCollapsed && (
                      <div className="mt-1 ml-9 space-y-1">
                        {item.children?.map((child) => {
                          const isChildActive = pathname === child.href;
                          return (
                            <SidebarTooltip
                              key={child.title}
                              show={child.isDummy}
                              text="This is a dummy element."
                            >
                              <Link
                                href={child.href}
                                onClick={(e) => {
                                  if (child.isDummy) e.preventDefault();
                                }}
                                className={cn(
                                  "w-full block px-3 py-2 rounded-lg text-[13px] font-medium transition-all",
                                  isChildActive
                                    ? "bg-ink text-white shadow-sm"
                                    : "text-muted-foreground hover:text-ink hover:bg-canvas",
                                )}
                              >
                                {child.title}
                              </Link>
                            </SidebarTooltip>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Utilities & Bottom Actions */}
      <div className="shrink-0 p-4 pb-2">
        <div className="space-y-0.5 mb-2">
          {bottomLinks.map((item) => {
            const Icon = item.icon;
            const tooltipText = item.isDummy
              ? "This is a dummy element."
              : isCollapsed
                ? item.title
                : undefined;
            const showTooltip = item.isDummy || isCollapsed;

            return (
              <SidebarTooltip
                key={item.title}
                show={showTooltip}
                text={tooltipText}
              >
                <Link
                  href={item.href}
                  onClick={(e) => {
                    if (item.isDummy) e.preventDefault();
                  }}
                  className={cn(
                    "w-full flex items-center rounded-lg text-[13px] font-medium text-muted-foreground hover:bg-canvas hover:text-ink transition-all group",
                    isCollapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground group-hover:text-ink transition-colors",
                      !isCollapsed && "mr-3",
                    )}
                  />
                  {!isCollapsed && (
                    <span className="whitespace-nowrap">{item.title}</span>
                  )}
                </Link>
              </SidebarTooltip>
            );
          })}
        </div>
      </div>

      {/* User Profile Block */}
      <div className="shrink-0 p-2 border-t border-line">
        <div
          className={cn(
            "w-full flex items-center p-2 rounded-xl hover:bg-canvas transition-colors cursor-pointer group",
            isCollapsed ? "justify-center" : "justify-between",
          )}
        >
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <Image
                src={getAvatarUrl(user?.name, user?.email)}
                alt="User"
                width={36}
                height={36}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-white"
              />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            {!isCollapsed && (
              <div className="flex flex-col whitespace-nowrap">
                <span className="text-[13px] font-semibold text-ink leading-tight">
                  {user?.name || "Wei Chen"}
                </span>
                <span className="text-[11px] text-muted-foreground font-medium leading-tight truncate max-w-[120px]">
                  {user?.email || "wei@counterfoil.app"}
                </span>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button
              onClick={(e) => {
                e.preventDefault();
                logout();
              }}
              className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-ink transition-all p-1 shrink-0"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
