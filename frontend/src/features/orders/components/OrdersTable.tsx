import {
  useOrders,
  useReserveOrder,
  useCancelOrder,
  CustomerOrder,
} from "../api/orders";
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

export function OrdersTable() {
  const { data, isLoading } = useOrders();
  const reserveOrder = useReserveOrder();
  const cancelOrder = useCancelOrder();
  const user = useAuthStore((state) => state.user);

  if (isLoading) return <div>Loading customer orders...</div>;
  if (!data?.data?.length)
    return <div className="text-muted-foreground p-4">No orders found.</div>;

  const handleReserve = (order: CustomerOrder) => {
    if (!window.confirm(`Reserve stock for order ${order.code}?`)) return;
    reserveOrder.mutate(order.id, {
      onError: (err: unknown) => {
        const e = err as {
          response?: { data?: { error?: { message?: string } } };
        };
        window.alert(
          e.response?.data?.error?.message || "Failed to reserve stock",
        );
      },
    });
  };

  const handleCancel = (order: CustomerOrder) => {
    if (
      !window.confirm(
        `Cancel order ${order.code}? This will release any reserved stock.`,
      )
    )
      return;
    cancelOrder.mutate(order.id, {
      onError: (err: unknown) => {
        const e = err as {
          response?: { data?: { error?: { message?: string } } };
        };
        window.alert(
          e.response?.data?.error?.message || "Failed to cancel order",
        );
      },
    });
  };

  const canManage = user?.role === "ADMIN" || user?.role === "SALES";

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Lines</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.data.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-medium">{order.code}</TableCell>
              <TableCell>{order.customer.name}</TableCell>
              <TableCell>{order.locationId}</TableCell>
              <TableCell>
                <ul className="list-disc pl-4 text-xs">
                  {order.lines.map((line) => (
                    <li key={line.id}>
                      {line.item.name}: {line.quantity}
                    </li>
                  ))}
                </ul>
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    order.status === "RESERVED"
                      ? "default"
                      : order.status === "CANCELLED"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {order.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right space-x-2">
                {canManage && order.status === "DRAFT" && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleReserve(order)}
                  >
                    Reserve
                  </Button>
                )}
                {canManage &&
                  (order.status === "DRAFT" || order.status === "RESERVED") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancel(order)}
                    >
                      Cancel
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
