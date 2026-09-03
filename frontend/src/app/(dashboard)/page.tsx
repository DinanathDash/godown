"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/api/dashboard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Users,
  Package,
  FileText,
  AlertTriangle,
  CalendarCheck,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import ReactECharts from "echarts-for-react";
import {
  EChartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "@/components/evilcharts/charts/echarts-bar-chart";

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dashboardApi.getSummary(),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[300px] w-full rounded-xl" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-ink mb-2">
          Error Loading Dashboard
        </h2>
        <p className="text-muted-foreground">
          Could not fetch dashboard summary.
        </p>
      </div>
    );
  }

  const { customers, products, challans, lowStockItems, followUpsDue } = data;
  const inactiveCustomers =
    customers.total - (customers.active + customers.lead);

  const challanChartConfig = {
    draft: {
      label: "Draft",
      colors: { light: ["#3b82f6"], dark: ["#3b82f6"] },
    },
    confirmed: {
      label: "Confirmed",
      colors: { light: ["#10b981"], dark: ["#10b981"] },
    },
    cancelled: {
      label: "Cancelled",
      colors: { light: ["#ef4444"], dark: ["#ef4444"] },
    },
  };

  const customerChartOption = {
    tooltip: { trigger: "item" },
    legend: {
      bottom: 0,
      left: "center",
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: "#64748b", fontSize: 12 },
      icon: "circle",
    },
    series: [
      {
        type: "pie",
        radius: ["55%", "85%"],
        center: ["50%", "45%"],
        itemStyle: {
          borderRadius: 8,
          borderColor: "#fff",
          borderWidth: 2,
        },
        label: { show: false },
        data: [
          {
            value: customers.active,
            name: "Active",
            itemStyle: { color: "#3b82f6" },
          },
          {
            value: customers.lead,
            name: "Lead",
            itemStyle: { color: "#f59e0b" },
          },
          {
            value: inactiveCustomers,
            name: "Inactive",
            itemStyle: { color: "#ef4444" },
          },
        ],
      },
    ],
  };

  return (
    <div className="pb-8 tracking-[0.01em] space-y-8">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Dashboard
          </h1>
          <p className="text-muted-foreground text-[13px] leading-tight">
            Welcome to Counterfoil Overview.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Stat Tiles */}
          <Card className="bg-card shadow-sm border-[0.5px] border-border/50 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-5 pt-5">
              <CardTitle className="text-[12px] font-medium text-muted-foreground">
                Total customers
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="text-2xl font-bold">{customers.total}</div>
              <p className="text-xs text-muted-foreground">
                {customers.active} active, {customers.lead} leads
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-sm border-[0.5px] border-border/50 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-5 pt-5">
              <CardTitle className="text-[12px] font-medium text-muted-foreground">
                Total products
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="text-2xl font-bold">{products.total}</div>
              <p className="text-xs text-muted-foreground">
                {products.lowStock} running low
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-sm border-[0.5px] border-border/50 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-5 pt-5">
              <CardTitle className="text-[12px] font-medium text-muted-foreground">
                Challans today
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="text-2xl font-bold">{challans.todayCount}</div>
              <p className="text-xs text-muted-foreground">Created today</p>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-sm border-[0.5px] border-border/50 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-5 pt-5">
              <CardTitle className="text-[12px] font-medium text-muted-foreground">
                Pending drafts
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="text-2xl font-bold">{challans.draft}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting confirmation
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Charts */}
        <Card className="bg-card shadow-sm border-[0.5px] border-border/50 rounded-2xl">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-[12px] font-medium text-muted-foreground">
              Challan distribution
            </CardTitle>
            <CardDescription className="text-[13px] leading-tight">
              Current state of all challans
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="h-[250px] w-full">
              <EChartsBarChart
                className="h-full w-full"
                data={data.monthlyChallans}
                config={challanChartConfig}
                xDataKey="month"
              >
                <XAxis />
                <YAxis hideDots />
                <Tooltip />
                <Legend verticalAlign="bottom" />
                <Bar dataKey="draft" />
                <Bar dataKey="confirmed" />
                <Bar dataKey="cancelled" />
              </EChartsBarChart>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-[0.5px] border-border/50 rounded-2xl">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-[12px] font-medium text-muted-foreground">
              Customer status
            </CardTitle>
            <CardDescription className="text-[13px] leading-tight">
              Breakdown of customer base
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center px-5 pb-5">
            <div className="h-[250px] w-full">
              <ReactECharts
                option={customerChartOption}
                style={{ height: "100%", width: "100%" }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Actionable Lists */}
        <Card className="flex flex-col bg-card shadow-sm border-[0.5px] border-border/50 rounded-2xl">
          <CardHeader className="flex flex-row items-start justify-between px-5 pt-5 pb-2 space-y-0">
            <div className="space-y-1">
              <CardTitle className="flex items-center text-destructive text-[12px] font-medium">
                <AlertTriangle className="mr-2 h-4 w-4" /> Low stock items
              </CardTitle>
              <CardDescription className="text-[13px] leading-tight">
                Products at or below their minimum stock threshold.
              </CardDescription>
            </div>
            {lowStockItems.length > 5 && (
              <Link href="/products?lowStock=true" className="shrink-0 ml-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-primary hover:text-primary/80 hover:bg-primary/10"
                >
                  View All ({lowStockItems.length})
                </Button>
              </Link>
            )}
          </CardHeader>
          <CardContent className="flex-1 px-5 pb-5">
            {lowStockItems.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                No low stock items. All good!
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                {lowStockItems.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between border-b-[0.5px] border-border/50 pb-2 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium text-[13px] leading-tight">
                        {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground leading-tight">
                        SKU: {item.sku}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-destructive text-[13px] leading-tight">
                        {item.currentStock}
                      </p>
                      <p className="text-xs text-muted-foreground leading-tight">
                        Min: {item.minStockAlert}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col bg-card shadow-sm border-[0.5px] border-border/50 rounded-2xl">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="flex items-center text-amber-500 text-[12px] font-medium">
              <CalendarCheck className="mr-2 h-4 w-4" /> Follow-ups due
            </CardTitle>
            <CardDescription className="text-[13px] leading-tight">
              Customers requiring attention this week.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 px-5 pb-5">
            {followUpsDue.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <TrendingUp className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                No pending follow-ups. Great job!
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                {followUpsDue.slice(0, 5).map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between border-b-[0.5px] border-border/50 pb-2 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium text-[13px] leading-tight">
                        {customer.name}
                      </p>
                      <p className="text-xs text-muted-foreground leading-tight">
                        {customer.businessName || "N/A"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] leading-tight font-medium text-amber-600">
                        {customer.followUpDate
                          ? format(new Date(customer.followUpDate), "MMM dd")
                          : ""}
                      </p>
                      <Link href={`/customers/${customer.id}`}>
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 h-auto text-xs"
                        >
                          View CRM
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
