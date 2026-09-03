import {
  useTransfers,
  useDispatchTransfer,
  useReceiveTransfer,
  useCancelTransfer,
  Transfer,
} from "../api/transfers";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Check, X, Send } from "lucide-react";

export function TransfersTable() {
  const page = 1;
  const { data, isLoading } = useTransfers({ page, limit: 20 });
  const dispatchMutation = useDispatchTransfer();
  const receiveMutation = useReceiveTransfer();
  const cancelMutation = useCancelTransfer();
  const { user } = useAuthStore();

  const canManage = user?.role === "ADMIN" || user?.role === "OPERATIONS";

  const handleAction = async (
    action: "DISPATCH" | "RECEIVE" | "CANCEL",
    id: string,
  ) => {
    try {
      if (action === "DISPATCH") await dispatchMutation.mutateAsync(id);
      if (action === "RECEIVE") await receiveMutation.mutateAsync(id);
      if (action === "CANCEL") await cancelMutation.mutateAsync(id);
      window.alert(`Transfer ${action.toLowerCase()}ed successfully`);
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      window.alert(
        error.response?.data?.error?.message ||
          `Failed to ${action.toLowerCase()} transfer`,
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    REQUESTED: "bg-yellow-500/10 text-yellow-500",
    DISPATCHED: "bg-blue-500/10 text-blue-500",
    RECEIVED: "bg-green-500/10 text-green-500",
    CANCELLED: "bg-red-500/10 text-red-500",
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Batch</TableHead>
            <TableHead>Route</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.data.map((transfer: Transfer) => (
            <TableRow key={transfer.id}>
              <TableCell className="font-medium">{transfer.code}</TableCell>
              <TableCell>
                <div>{transfer.item.name}</div>
                <div className="text-xs text-muted-foreground">
                  {transfer.item.sku}
                </div>
              </TableCell>
              <TableCell>{transfer.batch.code}</TableCell>
              <TableCell>
                <div className="flex items-center space-x-2 text-sm">
                  <span>{transfer.source.code}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span>{transfer.destination.code}</span>
                </div>
              </TableCell>
              <TableCell>
                {transfer.quantity}
                {transfer.status === "RECEIVED" && (
                  <span className="text-green-500 text-xs ml-1">
                    (Received {transfer.receivedQty})
                  </span>
                )}
                {transfer.status === "DISPATCHED" && (
                  <span className="text-blue-500 text-xs ml-1">
                    (Dispatched {transfer.dispatchedQty})
                  </span>
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={statusColors[transfer.status] || ""}
                >
                  {transfer.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {canManage && (
                  <div className="flex justify-end space-x-2">
                    {transfer.status === "REQUESTED" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction("DISPATCH", transfer.id)}
                          disabled={dispatchMutation.isPending}
                        >
                          <Send className="h-4 w-4 mr-1" /> Dispatch
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500"
                          onClick={() => handleAction("CANCEL", transfer.id)}
                          disabled={cancelMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {transfer.status === "DISPATCHED" && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleAction("RECEIVE", transfer.id)}
                        disabled={receiveMutation.isPending}
                      >
                        <Check className="h-4 w-4 mr-1" /> Receive
                      </Button>
                    )}
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
          {data?.data.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center">
                No transfers found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
