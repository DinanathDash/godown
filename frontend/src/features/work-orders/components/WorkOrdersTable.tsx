import {
  useWorkOrders,
  useUpdateWorkOrderStatus,
  WorkOrder,
} from "../api/work-orders";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";

export function WorkOrdersTable() {
  const { data, isLoading } = useWorkOrders();
  const updateStatus = useUpdateWorkOrderStatus();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  if (isLoading) return <div>Loading work orders...</div>;
  if (!data?.data?.length)
    return (
      <div className="text-muted-foreground p-4">No work orders found.</div>
    );

  const handleUpdateStatus = (
    wo: WorkOrder,
    newStatus: WorkOrder["status"],
  ) => {
    if (!window.confirm(`Move work order ${wo.code} to ${newStatus}?`)) return;
    updateStatus.mutate(
      { id: wo.id, status: newStatus },
      {
        onError: (err: unknown) => {
          const e = err as {
            response?: { data?: { error?: { message?: string } } };
          };
          window.alert(
            e.response?.data?.error?.message || "Failed to update status",
          );
        },
      },
    );
  };

  const handleRequestTransfer = (wo: WorkOrder) => {
    // Navigate to transfers with prefilled data using query params
    const params = new URLSearchParams({
      action: "request",
      itemId: wo.itemId,
      destinationLocationId: wo.locationId,
      quantity: wo.shortageQty.toString(),
    });
    router.push(`/transfers?${params.toString()}`);
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Required</TableHead>
            <TableHead className="text-right">Available</TableHead>
            <TableHead className="text-right">Shortage</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.data.map((wo) => (
            <TableRow key={wo.id}>
              <TableCell className="font-medium">{wo.code}</TableCell>
              <TableCell>{wo.location.code}</TableCell>
              <TableCell>{wo.item.name}</TableCell>
              <TableCell className="text-right">{wo.requiredQty}</TableCell>
              <TableCell className="text-right">{wo.availableQty}</TableCell>
              <TableCell className="text-right font-bold text-red-500">
                {wo.shortageQty > 0 ? wo.shortageQty : 0}
              </TableCell>
              <TableCell>{wo.assignedTo.name}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    wo.status === "COMPLETED"
                      ? "default"
                      : wo.status === "IN_PROGRESS"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {wo.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right space-x-2">
                {wo.shortageQty > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRequestTransfer(wo)}
                  >
                    Request Transfer
                  </Button>
                )}
                {(user?.role === "ADMIN" || user?.role === "OPERATIONS") &&
                  wo.status === "ASSIGNED" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUpdateStatus(wo, "IN_PROGRESS")}
                    >
                      Start
                    </Button>
                  )}
                {(user?.role === "ADMIN" || user?.role === "OPERATIONS") &&
                  wo.status === "IN_PROGRESS" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUpdateStatus(wo, "COMPLETED")}
                    >
                      Complete
                    </Button>
                  )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
