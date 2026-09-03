"use client";

import { useState } from "react";
import {
  useOrders,
  useReserveOrder,
  useCancelOrder,
  useLocations,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { useAuthStore } from "@/store/useAuthStore";
import { ShoppingCart } from "lucide-react";

const HEAD = "text-[12px] font-medium text-muted-foreground tracking-wider";
const CARD =
  "bg-card shadow-sm border-[0.5px] border-border/50 rounded-2xl overflow-hidden";

function StatusBadge({ status }: { status: CustomerOrder["status"] }) {
  switch (status) {
    case "RESERVED":
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 rounded-[6px]">
          Reserved
        </Badge>
      );
    case "CANCELLED":
      return (
        <Badge variant="destructive" className="rounded-[6px]">
          Cancelled
        </Badge>
      );
    case "FULFILLED":
      return (
        <Badge variant="secondary" className="rounded-[6px]">
          Fulfilled
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="rounded-[6px]">
          Draft
        </Badge>
      );
  }
}

type PendingAction = { order: CustomerOrder; action: "RESERVE" | "CANCEL" };

export function OrdersTable() {
  const { data, isLoading } = useOrders();
  const { data: locations } = useLocations();
  const reserveOrder = useReserveOrder();
  const cancelOrder = useCancelOrder();
  const user = useAuthStore((state) => state.user);

  const [pending, setPending] = useState<PendingAction | null>(null);

  const canManage = user?.role === "ADMIN" || user?.role === "SALES";

  // The order payload carries only locationId, so resolve the readable code
  // here rather than printing a UUID at the user.
  const locationCode = (id: string) =>
    locations?.find((l) => l.id === id)?.code ?? "—";

  const onError = (err: unknown, fallback: string) => {
    const e = err as { response?: { data?: { error?: { message?: string } } } };
    toast.add({
      // The server explains the real reason — most often that another order
      // took the stock first — so lead with its message.
      title: fallback,
      description: e.response?.data?.error?.message ?? "Please try again.",
      type: "error",
    });
  };

  const execute = () => {
    if (!pending) return;
    const { order, action } = pending;
    setPending(null);

    if (action === "RESERVE") {
      reserveOrder.mutate(order.id, {
        onSuccess: () =>
          toast.add({
            title: "Stock reserved",
            description: `${order.code} now holds its stock against available quantity.`,
          }),
        onError: (err) => onError(err, "Could not reserve stock"),
      });
    } else {
      cancelOrder.mutate(order.id, {
        onSuccess: () =>
          toast.add({
            title: "Order cancelled",
            description: `Any stock reserved by ${order.code} has been released.`,
          }),
        onError: (err) => onError(err, "Could not cancel order"),
      });
    }
  };

  if (isLoading) {
    return (
      <div className={CARD}>
        <Table>
          <TableHeader>
            <TableRow className="bg-canvas/50 border-b-[0.5px] border-border/50">
              <TableHead className={`${HEAD} pl-5`}>Code</TableHead>
              <TableHead className={HEAD}>Customer</TableHead>
              <TableHead className={HEAD}>Location</TableHead>
              <TableHead className={HEAD}>Lines</TableHead>
              <TableHead className={HEAD}>Status</TableHead>
              <TableHead className={`${HEAD} text-right pr-5`}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i} className="border-b-[0.5px] border-border/50">
                <TableCell className="pl-5"><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-44" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20 rounded-[6px]" /></TableCell>
                <TableCell className="pr-5"><Skeleton className="h-8 w-24 ml-auto rounded-[10px]" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (!data?.data?.length) {
    return (
      <div className={`${CARD} py-20 text-center`}>
        <ShoppingCart
          className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3"
          strokeWidth={1}
        />
        <p className="font-medium text-[13px] text-ink">No customer orders yet</p>
        <p className="text-[13px] leading-tight text-muted-foreground mt-1">
          Create one to reserve stock against a customer.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={CARD}>
        <Table>
          <TableHeader>
            <TableRow className="bg-canvas/50 hover:bg-canvas/50 border-b-[0.5px] border-border/50">
              <TableHead className={`${HEAD} pl-5`}>Code</TableHead>
              <TableHead className={HEAD}>Customer</TableHead>
              <TableHead className={HEAD}>Location</TableHead>
              <TableHead className={HEAD}>Lines</TableHead>
              <TableHead className={HEAD}>Status</TableHead>
              <TableHead className={`${HEAD} text-right pr-5`}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.map((order) => (
              <TableRow
                key={order.id}
                className="border-b-[0.5px] border-border/50"
              >
                <TableCell className="font-mono font-medium text-[13px] leading-tight pl-5">
                  {order.code}
                </TableCell>
                <TableCell className="font-medium text-ink text-[13px] leading-tight">
                  {order.customer.name}
                </TableCell>
                <TableCell className="text-[13px] leading-tight">
                  {locationCode(order.locationId)}
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    {order.lines.map((line) => (
                      <div
                        key={line.id}
                        className="text-[13px] leading-tight flex gap-2"
                      >
                        <span className="text-muted-foreground tabular-nums">
                          {line.quantity}×
                        </span>
                        <span>{line.item.name}</span>
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={order.status} />
                </TableCell>
                <TableCell className="text-right pr-5">
                  <div className="flex justify-end gap-2">
                    {canManage && order.status === "DRAFT" && (
                      <Button
                        onClick={() => setPending({ order, action: "RESERVE" })}
                        disabled={reserveOrder.isPending}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-[10px] h-8 text-[12px] shadow-sm"
                      >
                        Reserve
                      </Button>
                    )}
                    {canManage &&
                      (order.status === "DRAFT" ||
                        order.status === "RESERVED") && (
                        <Button
                          variant="outline"
                          onClick={() => setPending({ order, action: "CANCEL" })}
                          disabled={cancelOrder.isPending}
                          className="rounded-[10px] h-8 text-[12px] shadow-sm border-[0.5px] border-border/50"
                        >
                          Cancel
                        </Button>
                      )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <AlertDialogContent className="rounded-[12px]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.action === "RESERVE"
                ? `Reserve stock for ${pending?.order.code}?`
                : `Cancel ${pending?.order.code}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.action === "RESERVE"
                ? "This holds stock against this order. It stays physically in the godown but stops being available to anyone else."
                : "Any stock this order is holding will be released back to available."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[10px]">
              Go back
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={execute}
              className={`rounded-[10px] ${
                pending?.action === "CANCEL"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
            >
              {pending?.action === "RESERVE" ? "Reserve stock" : "Cancel order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
