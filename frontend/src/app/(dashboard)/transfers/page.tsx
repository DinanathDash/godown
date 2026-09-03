"use client";

import { TransfersTable } from "@/features/transfers/components/TransfersTable";
import { CreateTransferDialog } from "@/features/transfers/components/CreateTransferDialog";
import { useAuthStore } from "@/store/useAuthStore";

export default function TransfersPage() {
  const user = useAuthStore((state) => state.user);
  const canCreate = user?.role === "ADMIN" || user?.role === "OPERATIONS";

  return (
    <div className="pb-8 tracking-[0.01em] space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-ink">Internal transfers</h1>
          <p className="text-muted-foreground text-[13px] leading-tight">
            Stock moving between godowns. Dispatched quantity is in transit
            until it is received.
          </p>
        </div>
        {canCreate && <CreateTransferDialog />}
      </div>
      <TransfersTable />
    </div>
  );
}
