"use client";

import { useAuthStore } from "@/store/useAuthStore";
import { WorkOrdersTable } from "@/features/work-orders/components/WorkOrdersTable";
import { CreateWorkOrderDialog } from "@/features/work-orders/components/CreateWorkOrderDialog";

export default function WorkOrdersPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Work Orders</h2>
        {user?.role === "ADMIN" && (
          <div className="flex items-center space-x-2">
            <CreateWorkOrderDialog />
          </div>
        )}
      </div>

      <WorkOrdersTable />
    </div>
  );
}
