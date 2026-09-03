import { InventoryTable } from "@/features/inventory/components/InventoryTable";

export default function InventoryPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Inventory</h2>
      </div>
      <InventoryTable />
    </div>
  );
}
