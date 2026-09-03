"use client";

import { useAuthStore } from "@/store/useAuthStore";
import { OrdersTable } from "@/features/orders/components/OrdersTable";
import { CreateOrderDialog } from "@/features/orders/components/CreateOrderDialog";

export default function OrdersPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Customer Orders</h2>
        {(user?.role === "ADMIN" || user?.role === "SALES") && (
          <div className="flex items-center space-x-2">
            <CreateOrderDialog />
          </div>
        )}
      </div>

      <OrdersTable />
    </div>
  );
}
