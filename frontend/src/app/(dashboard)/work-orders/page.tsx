"use client";

import { useAuthStore } from "@/store/useAuthStore";
import { WorkOrdersTable } from "@/features/work-orders/components/WorkOrdersTable";
import { CreateWorkOrderDialog } from "@/features/work-orders/components/CreateWorkOrderDialog";

export default function WorkOrdersPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="pb-8 tracking-[0.01em] space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-ink">Work orders</h1>
          <p className="text-muted-foreground text-[13px] leading-tight">
            Material requirements and the shortage at each location.
          </p>
        </div>
        {user?.role === "ADMIN" && <CreateWorkOrderDialog />}
      </div>
      <WorkOrdersTable />
    </div>
  );
}
