import { InventoryTable } from "@/features/inventory/components/InventoryTable";

export default function InventoryPage() {
  return (
    <div className="pb-8 tracking-[0.01em] space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Inventory</h1>
        <p className="text-muted-foreground text-[13px] leading-tight">
          Stock on hand across every godown, by item and batch.
        </p>
      </div>
      <InventoryTable />
    </div>
  );
}
