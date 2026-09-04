"use client";

import { useState } from "react";
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
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";

const HEAD = "text-[12px] font-medium text-muted-foreground tracking-wider";
const CARD =
  "bg-card shadow-sm border-[0.5px] border-border/50 rounded-2xl overflow-hidden";

const STATUS_LABEL: Record<WorkOrder["status"], string> = {
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

function StatusBadge({ status }: { status: WorkOrder["status"] }) {
  if (status === "COMPLETED") {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-700 rounded-[6px] text-white">
        Completed
      </Badge>
    );
  }
  if (status === "IN_PROGRESS") {
    return (
      <Badge className="bg-blue-500 hover:bg-blue-600 rounded-[6px] text-white">
        In progress
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="rounded-[6px]">
      Assigned
    </Badge>
  );
}

export function WorkOrdersTable() {
  const { data, isLoading } = useWorkOrders();
  const updateStatus = useUpdateWorkOrderStatus();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  // Replaces window.confirm — a native dialog can't be styled, blocks the main
  // thread, and looks nothing like the rest of the app.
  const [pending, setPending] = useState<{
    wo: WorkOrder;
    status: WorkOrder["status"];
  } | null>(null);

  const canOperate = user?.role === "ADMIN" || user?.role === "OPERATIONS";

  const executeStatusChange = () => {
    if (!pending) return;
    const { wo, status } = pending;
    setPending(null);

    updateStatus.mutate(
      { id: wo.id, status },
      {
        onSuccess: () =>
          toast.add({
            title: "Work order updated",
            description: `${wo.code} moved to ${STATUS_LABEL[status]}.`,
          }),
        onError: (err: unknown) => {
          const e = err as {
            response?: { data?: { error?: { message?: string } } };
          };
          toast.add({
            title: "Could not update work order",
            description:
              e.response?.data?.error?.message ?? "Please try again.",
            type: "error",
          });
        },
      },
    );
  };

  const handleRequestTransfer = (wo: WorkOrder) => {
    const params = new URLSearchParams({
      action: "request",
      itemId: wo.itemId,
      destinationLocationId: wo.locationId,
      quantity: wo.shortageQty.toString(),
    });
    router.push(`/transfers?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <div className={CARD}>
        <Table>
          <TableHeader>
            <TableRow className="bg-canvas/50 border-b-[0.5px] border-border/50">
              <TableHead className={`${HEAD} pl-5`}>Code</TableHead>
              <TableHead className={HEAD}>Location</TableHead>
              <TableHead className={HEAD}>Item</TableHead>
              <TableHead className={`${HEAD} text-right`}>Required</TableHead>
              <TableHead className={`${HEAD} text-right`}>Available</TableHead>
              <TableHead className={`${HEAD} text-right`}>Shortage</TableHead>
              <TableHead className={HEAD}>Assignee</TableHead>
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
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-40" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-10 ml-auto" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-10 ml-auto" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-10 ml-auto" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20 rounded-[6px]" />
                </TableCell>
                <TableCell className="pr-5">
                  <Skeleton className="h-8 w-20 ml-auto rounded-[10px]" />
                </TableCell>
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
        <ClipboardList
          className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3"
          strokeWidth={1}
        />
        <p className="font-medium text-[13px] text-ink">No work orders yet</p>
        <p className="text-[13px] leading-tight text-muted-foreground mt-1">
          An admin can raise one against any item and location.
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
              <TableHead className={HEAD}>Location</TableHead>
              <TableHead className={HEAD}>Item</TableHead>
              <TableHead className={`${HEAD} text-right`}>Required</TableHead>
              <TableHead className={`${HEAD} text-right`}>Available</TableHead>
              <TableHead className={`${HEAD} text-right`}>Shortage</TableHead>
              <TableHead className={HEAD}>Assignee</TableHead>
              <TableHead className={HEAD}>Status</TableHead>
              <TableHead className={`${HEAD} text-right pr-5`}>
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.map((wo) => {
              const short = wo.shortageQty > 0;
              return (
                <TableRow
                  key={wo.id}
                  className="border-b-[0.5px] border-border/50"
                >
                  <TableCell className="font-mono font-medium text-[13px] leading-tight pl-5">
                    {wo.code}
                  </TableCell>
                  <TableCell className="text-[13px] leading-tight">
                    {wo.location.code}
                  </TableCell>
                  <TableCell className="font-medium text-ink text-[13px] leading-tight">
                    {wo.item.name}
                  </TableCell>
                  <TableCell className="text-right text-[13px] leading-tight tabular-nums">
                    {wo.requiredQty}
                  </TableCell>
                  <TableCell className="text-right text-[13px] leading-tight tabular-nums text-muted-foreground">
                    {wo.availableQty}
                  </TableCell>
                  {/* Shortage only reads as a problem when there is one. */}
                  <TableCell
                    className={`text-right text-[13px] leading-tight tabular-nums ${
                      short
                        ? "font-medium text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {short ? wo.shortageQty : 0}
                  </TableCell>
                  <TableCell className="text-[13px] leading-tight">
                    {wo.assignedTo.name}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={wo.status} />
                  </TableCell>
                  <TableCell className="text-right pr-5">
                    <div className="flex justify-end gap-2">
                      {short && (
                        <Button
                          variant="outline"
                          onClick={() => handleRequestTransfer(wo)}
                          className="rounded-[10px] h-8 text-[12px] shadow-sm border-[0.5px] border-border/50"
                        >
                          Request transfer
                        </Button>
                      )}
                      {canOperate && wo.status === "ASSIGNED" && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            setPending({ wo, status: "IN_PROGRESS" })
                          }
                          className="rounded-[10px] h-8 text-[12px] shadow-sm border-[0.5px] border-border/50"
                        >
                          Start
                        </Button>
                      )}
                      {canOperate && wo.status === "IN_PROGRESS" && (
                        <Button
                          onClick={() =>
                            setPending({ wo, status: "COMPLETED" })
                          }
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-[10px] h-8 text-[12px] shadow-sm"
                        >
                          Complete
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
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
              Move {pending?.wo.code} to{" "}
              {pending ? STATUS_LABEL[pending.status] : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Work order status only moves forward, so this cannot be undone
              from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[10px]">
              Go back
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeStatusChange}
              className="rounded-[10px]"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
