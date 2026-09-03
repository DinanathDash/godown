"use client";

import { useAuthStore } from "@/store/useAuthStore";
import { OrdersTable } from "@/features/orders/components/OrdersTable";
import { CreateOrderDialog } from "@/features/orders/components/CreateOrderDialog";

export default function OrdersPage() {
  const user = useAuthStore((state) => state.user);
  const canCreate = user?.role === "ADMIN" || user?.role === "SALES";

  return (
    <div className="pb-8 tracking-[0.01em] space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-ink">Customer orders</h1>
          <p className="text-muted-foreground text-[13px] leading-tight">
            Reserving an order holds stock against it without moving it.
          </p>
        </div>
        {canCreate && <CreateOrderDialog />}
      </div>
      <OrdersTable />
    </div>
  );
}
