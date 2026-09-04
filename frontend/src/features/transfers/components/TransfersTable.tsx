"use client";

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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { useAuthStore } from "@/store/useAuthStore";
import { ArrowRight, Check, X, Send, Truck } from "lucide-react";

const HEAD = "text-[12px] font-medium text-muted-foreground tracking-wider";
const CARD =
  "bg-card shadow-sm border-[0.5px] border-border/50 rounded-2xl overflow-hidden";

function StatusBadge({ status }: { status: Transfer["status"] }) {
  switch (status) {
    case "RECEIVED":
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 rounded-[6px]">
          Received
        </Badge>
      );
    case "DISPATCHED":
      return (
        <Badge variant="secondary" className="rounded-[6px]">
          In transit
        </Badge>
      );
    case "CANCELLED":
      return (
        <Badge variant="destructive" className="rounded-[6px]">
          Cancelled
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="rounded-[6px]">
          Requested
        </Badge>
      );
  }
}

export function TransfersTable() {
  const { data, isLoading } = useTransfers({ page: 1, limit: 20 });
  const dispatchMutation = useDispatchTransfer();
  const receiveMutation = useReceiveTransfer();
  const cancelMutation = useCancelTransfer();
  const user = useAuthStore((state) => state.user);

  const canManage = user?.role === "ADMIN" || user?.role === "OPERATIONS";

  const handleAction = async (
    action: "DISPATCH" | "RECEIVE" | "CANCEL",
    transfer: Transfer,
  ) => {
    const done: Record<typeof action, { title: string; description: string }> =
      {
        DISPATCH: {
          title: "Transfer dispatched",
          description: `Stock has left ${transfer.source.code} and is in transit.`,
        },
        RECEIVE: {
          title: "Transfer received",
          description: `Stock is now on hand at ${transfer.destination.code}.`,
        },
        CANCEL: {
          title: "Transfer cancelled",
          description: `${transfer.code} will not be dispatched.`,
        },
      };

    try {
      if (action === "DISPATCH")
        await dispatchMutation.mutateAsync(transfer.id);
      if (action === "RECEIVE") await receiveMutation.mutateAsync(transfer.id);
      if (action === "CANCEL") await cancelMutation.mutateAsync(transfer.id);
      toast.add(done[action]);
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      toast.add({
        title: `Could not ${action.toLowerCase()} transfer`,
        // The server's message is the useful one here — it explains *why*
        // (already received, not enough unreserved stock at source, …).
        description:
          error.response?.data?.error?.message ?? "Please try again.",
        type: "error",
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
              <TableHead className={HEAD}>Item</TableHead>
              <TableHead className={HEAD}>Batch</TableHead>
              <TableHead className={HEAD}>Route</TableHead>
              <TableHead className={`${HEAD} text-right`}>Quantity</TableHead>
              <TableHead className={HEAD}>Status</TableHead>
              <TableHead className={`${HEAD} text-right pr-5`}>
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i} className="border-b-[0.5px] border-border/50">
                <TableCell className="pl-5">
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-40" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-10 ml-auto" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20 rounded-[6px]" />
                </TableCell>
                <TableCell className="pr-5">
                  <Skeleton className="h-8 w-24 ml-auto rounded-[10px]" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (!data?.data.length) {
    return (
      <div className={`${CARD} py-20 text-center`}>
        <Truck
          className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3"
          strokeWidth={1}
        />
        <p className="font-medium text-[13px] text-ink">No transfers yet</p>
        <p className="text-[13px] leading-tight text-muted-foreground mt-1">
          Raise one to move stock between godowns.
        </p>
      </div>
    );
  }

  return (
    <div className={CARD}>
      <Table>
        <TableHeader>
          <TableRow className="bg-canvas/50 hover:bg-canvas/50 border-b-[0.5px] border-border/50">
            <TableHead className={`${HEAD} pl-5`}>Code</TableHead>
            <TableHead className={HEAD}>Item</TableHead>
            <TableHead className={HEAD}>Batch</TableHead>
            <TableHead className={HEAD}>Route</TableHead>
            <TableHead className={`${HEAD} text-right`}>Quantity</TableHead>
            <TableHead className={HEAD}>Status</TableHead>
            <TableHead className={`${HEAD} text-right pr-5`}>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.data.map((transfer: Transfer) => (
            <TableRow
              key={transfer.id}
              className="border-b-[0.5px] border-border/50"
            >
              <TableCell className="font-mono font-medium text-[13px] leading-tight pl-5">
                {transfer.code}
              </TableCell>
              <TableCell>
                <div className="font-medium text-ink text-[13px] leading-tight">
                  {transfer.item.name}
                </div>
                <div className="text-xs text-muted-foreground leading-tight mt-0.5">
                  {transfer.item.sku}
                </div>
              </TableCell>
              <TableCell className="text-[13px] leading-tight text-muted-foreground">
                {transfer.batch.code}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 text-[13px] leading-tight">
                  <span>{transfer.source.code}</span>
                  <ArrowRight
                    className="h-3.5 w-3.5 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                  <span>{transfer.destination.code}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="text-[13px] leading-tight tabular-nums font-medium">
                  {transfer.quantity}
                </div>
                {/* The brief's central rule made visible: dispatched stock has
                    left the source but has not landed anywhere yet. */}
                {transfer.status === "DISPATCHED" && (
                  <div className="text-xs text-muted-foreground leading-tight mt-0.5 tabular-nums">
                    {transfer.dispatchedQty} in transit
                  </div>
                )}
                {transfer.status === "RECEIVED" && (
                  <div className="text-xs text-muted-foreground leading-tight mt-0.5 tabular-nums">
                    {transfer.receivedQty} received
                  </div>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge status={transfer.status} />
              </TableCell>
              <TableCell className="text-right pr-5">
                {canManage && (
                  <div className="flex justify-end gap-2">
                    {transfer.status === "REQUESTED" && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => handleAction("DISPATCH", transfer)}
                          disabled={dispatchMutation.isPending}
                          className="rounded-[10px] h-8 text-[12px] shadow-sm border-[0.5px] border-border/50"
                        >
                          <Send className="h-3.5 w-3.5 mr-1.5" /> Dispatch
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleAction("CANCEL", transfer)}
                          disabled={cancelMutation.isPending}
                          aria-label={`Cancel transfer ${transfer.code}`}
                          className="rounded-[10px] h-8 text-destructive hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {transfer.status === "DISPATCHED" && (
                      <Button
                        onClick={() => handleAction("RECEIVE", transfer)}
                        disabled={receiveMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-[10px] h-8 text-[12px] shadow-sm"
                      >
                        <Check className="h-3.5 w-3.5 mr-1.5" /> Receive
                      </Button>
                    )}
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
