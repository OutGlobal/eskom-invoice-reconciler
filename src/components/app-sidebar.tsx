import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Upload,
  ReceiptText,
  Zap,
  Activity,
  Scale,
  FileBarChart,
  Settings as SettingsIcon,
  TrendingUp,
  Building2,
  AlertTriangle,
  ShieldCheck,
  Gauge,
  Calendar,
  FileText,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface NavSection {
  label: string;
  items: {
    title: string;
    url: string;
    icon: React.ComponentType<{ className?: string }>;
    matchUrls?: string[];
  }[];
}

const navSections: NavSection[] = [
  {
    label: "Operations",
    items: [
      { title: "Command Centre", url: "/", icon: LayoutDashboard },
      { title: "Invoice Workspace", url: "/invoices", icon: FileText, matchUrls: ["/invoices", "/upload"] },
      { title: "AMR Telemetry & Metering", url: "/telemetry", icon: Activity, matchUrls: ["/telemetry", "/meters", "/energy", "/demand"] },
      { title: "Reconciliation & Audits", url: "/reconciliation", icon: Scale, matchUrls: ["/reconciliation", "/anomalies", "/audit"] },
      { title: "Dispute Packs & Reports", url: "/reports", icon: FileBarChart, matchUrls: ["/reports", "/trends"] },
    ],
  },
  {
    label: "Regulatory & Compliance",
    items: [
      { title: "Tariffs & Regulations", url: "/tariff", icon: ReceiptText, matchUrls: ["/tariff", "/calendar"] },
      { title: "Data Governance & Quality", url: "/quality", icon: ShieldCheck },
      { title: "Municipal Statements", url: "/municipal", icon: Building2 },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Customers & Accounts", url: "/customers", icon: Users },
      { title: "Settings", url: "/settings", icon: SettingsIcon },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="h-8 w-8 shrink-0 rounded-md bg-accent flex items-center justify-center text-accent-foreground font-bold text-sm">
            MR
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight truncate">Meter Recon</div>
              <div className="text-[10px] text-muted-foreground truncate">Eskom Megaflex Platform</div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {navSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active =
                    pathname === item.url ||
                    Boolean(item.matchUrls && item.matchUrls.includes(pathname));
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                        <Link to={item.url} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
