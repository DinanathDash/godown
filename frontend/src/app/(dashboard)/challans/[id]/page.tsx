"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { challansApi } from "@/api/challans";
import { customersApi } from "@/api/customers";
import { productsApi } from "@/api/products";
import { useAuthStore } from "@/store/useAuthStore";
import { format } from "date-fns";
import Link from "next/link";
import { toast } from "@/components/ui/toast";

import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Edit, Trash2, CheckCircle2, Download } from "lucide-react";
import { ChallanPrintView } from "@/features/challans/ChallanPrintView";

export default function ChallanDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const {
    data: challan,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["challan", id],
    queryFn: () => challansApi.getChallan(id),
  });

  // ChallanForm needs both of these before it can render anything but its
  // own skeleton — warm them on hover so "Edit draft" usually opens instantly.
  const prefetchEditDeps = () => {
    queryClient
      .query({
        queryKey: ["customers", { limit: 1000 }],
        queryFn: () =>
          customersApi.getCustomers({ limit: 1000, status: "ACTIVE" }),
      })
      .catch(() => {});
    queryClient
      .query({
        queryKey: ["products", { limit: 1000 }],
        queryFn: () => productsApi.getProducts({ limit: 1000 }),
      })
      .catch(() => {});
  };

  const confirmMutation = useMutation({
    mutationFn: () => challansApi.confirmChallan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["challan", id] });
      queryClient.invalidateQueries({ queryKey: ["challans"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.add({
        title: "Challan Confirmed",
        description: "Stock has been successfully deducted.",
      });
      setIsConfirming(false);
    },
    onError: (err: unknown) => {
      const error = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      toast.add({
        title: "Failed to confirm",
        description:
          error.response?.data?.error?.message || "Could not confirm challan.",
        type: "error",
      });
      setIsConfirming(false);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => challansApi.cancelChallan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["challan", id] });
      queryClient.invalidateQueries({ queryKey: ["challans"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.add({
        title: "Challan Cancelled",
        description: "Challan cancelled and stock restored if applicable.",
      });
      setIsCancelling(false);
    },
    onError: (err: unknown) => {
      const error = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      toast.add({
        title: "Failed to cancel",
        description:
          error.response?.data?.error?.message || "Could not cancel challan.",
        type: "error",
      });
      setIsCancelling(false);
    },
  });

  const executeConfirm = () => {
    setIsConfirming(true);
    confirmMutation.mutate();
    setIsConfirmDialogOpen(false);
  };

  const handleConfirm = () => {
    setIsConfirmDialogOpen(true);
  };

  const executeCancel = () => {
    setIsCancelling(true);
    cancelMutation.mutate();
    setIsCancelDialogOpen(false);
  };

  const handleCancel = () => {
    setIsCancelDialogOpen(true);
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById("challan-print-document");
    if (!element) return;

    setIsDownloading(true);
    try {
      const { toJpeg } = await import("html-to-image");
      const jsPDF = (await import("jspdf")).default;

      // Use JPEG with compression to drastically reduce file size (from ~10MB down to <1MB)
      const dataUrl = await toJpeg(element, {
        pixelRatio: 2,
        quality: 0.8,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const elementWidth = element.offsetWidth;
      const elementHeight = element.offsetHeight;
      const pdfHeight = (elementHeight * pdfWidth) / elementWidth;

      pdf.addImage(
        dataUrl,
        "JPEG",
        0,
        0,
        pdfWidth,
        pdfHeight,
        undefined,
        "FAST",
      );
      pdf.save(`challan-${challan?.challanNumber || "draft"}.pdf`);
    } catch (error) {
      console.error("Failed to generate PDF", error);
      toast.add({
        title: "Download Failed",
        description: "Could not generate PDF.",
        type: "error",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="pb-8 tracking-[0.01em] space-y-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-9 w-9 rounded-[10px]" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
        </div>

        {/* Snapshot document */}
        <Card className="overflow-hidden rounded-2xl border-[0.5px] border-border/50 shadow-sm bg-card">
          <div className="bg-muted/30 p-6 md:p-10 border-b-[0.5px] border-border/50">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-28" />
              </div>
              <div className="space-y-2 items-end flex flex-col">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>
          <div className="p-6 md:p-10 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
            <div className="flex justify-end pt-4">
              <Skeleton className="h-6 w-40" />
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap justify-end gap-2">
          <Skeleton className="h-9 w-36 rounded-[10px]" />
          <Skeleton className="h-9 w-28 rounded-[10px]" />
        </div>
      </div>
    );
  }

  if (isError || !challan) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-ink mb-2">Challan Not Found</h2>
        <p className="text-muted-foreground mb-6">
          The challan you are looking for doesn&apos;t exist or has been
          deleted.
        </p>
        <Link
          href="/challans"
          className={buttonVariants({ variant: "default" })}
        >
          Back to Challans
        </Link>
      </div>
    );
  }

  const isDraft = challan.status === "DRAFT";
  const isConfirmed = challan.status === "CONFIRMED";
  const isCancelled = challan.status === "CANCELLED";

  const canEdit = isDraft && (user?.role === "ADMIN" || user?.role === "SALES");
  const canConfirm =
    isDraft &&
    (user?.role === "ADMIN" ||
      user?.role === "SALES" ||
      user?.role === "WAREHOUSE");
  const canCancelUser = user?.role === "ADMIN";

  return (
    <div className="pb-8 tracking-[0.01em] space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex items-center space-x-4">
          <Link
            href="/challans"
            className={buttonVariants({
              variant: "ghost",
              size: "icon",
              className: "rounded-[10px]",
            })}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-ink flex items-center gap-3">
              Challan{" "}
              {challan.challanNumber ? `#${challan.challanNumber}` : "(Draft)"}
              {isDraft && (
                <Badge variant="neutral" className="rounded-[6px]">
                  Draft
                </Badge>
              )}
              {isConfirmed && (
                <Badge variant="success" className="rounded-[6px]">
                  Confirmed
                </Badge>
              )}
              {isCancelled && (
                <Badge variant="destructive" className="rounded-[6px]">
                  Cancelled
                </Badge>
              )}
            </h1>
            <p className="text-[13px] leading-tight text-muted-foreground mt-1">
              Created on{" "}
              {format(new Date(challan.createdAt), "dd MMM yyyy, HH:mm")}
            </p>
          </div>
        </div>
      </div>

      {/* Snapshot Document */}
      <Card
        id="challan-document"
        className="overflow-hidden rounded-2xl border-[0.5px] border-border/50 shadow-sm bg-card"
      >
        <div className="bg-muted/30 p-6 md:p-10 border-b-[0.5px] border-border/50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Billed To
              </h2>
              <p className="font-bold text-lg text-ink">
                {challan.customerSnapshot?.name || "Unknown"}
              </p>
              {challan.customerSnapshot?.businessName && (
                <p className="text-[13px] leading-tight text-muted-foreground">
                  {challan.customerSnapshot.businessName}
                </p>
              )}
              {challan.customerSnapshot?.address && (
                <p className="text-[13px] leading-tight text-muted-foreground mt-1 whitespace-pre-wrap">
                  {challan.customerSnapshot.address}
                </p>
              )}
              {(challan.customerSnapshot?.mobile ||
                challan.customerSnapshot?.email) && (
                <p className="text-[13px] leading-tight text-muted-foreground mt-1">
                  {[
                    challan.customerSnapshot.mobile,
                    challan.customerSnapshot.email,
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </p>
              )}
              {challan.customerSnapshot?.gstNumber && (
                <p className="text-[13px] leading-tight text-muted-foreground mt-1">
                  GST:{" "}
                  <span className="font-mono">
                    {challan.customerSnapshot.gstNumber}
                  </span>
                </p>
              )}
            </div>
            <div className="text-right">
              <h2 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Challan Details
              </h2>
              <p className="font-medium text-[13px] leading-tight">
                No: {challan.challanNumber || "N/A"}
              </p>
              <p className="text-[13px] leading-tight text-muted-foreground mt-1">
                Date:{" "}
                {format(
                  new Date(
                    challan.confirmedAt ||
                      challan.cancelledAt ||
                      challan.createdAt,
                  ),
                  "dd MMM yyyy",
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-canvas/50 hover:bg-canvas/50 border-b-[0.5px] border-border/50">
                <TableHead className="w-[50px] text-center text-[12px] font-medium text-muted-foreground tracking-wider">
                  #
                </TableHead>
                <TableHead className="text-[12px] font-medium text-muted-foreground tracking-wider">
                  Item Details
                </TableHead>
                <TableHead className="text-right text-[12px] font-medium text-muted-foreground tracking-wider">
                  Quantity
                </TableHead>
                <TableHead className="text-right text-[12px] font-medium text-muted-foreground tracking-wider">
                  Rate
                </TableHead>
                <TableHead className="text-right pr-6 md:pr-10 text-[12px] font-medium text-muted-foreground tracking-wider">
                  Amount
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {challan.items?.map((item, index) => (
                <TableRow
                  key={item.id}
                  className="border-b-[0.5px] border-border/50"
                >
                  <TableCell className="text-center text-[13px] leading-tight text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-[13px] leading-tight">
                      {item.productName}
                    </div>
                    <div className="text-xs text-muted-foreground leading-tight">
                      SKU: {item.sku}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-[13px] leading-tight">
                    {item.quantity}
                  </TableCell>
                  <TableCell className="text-right text-[13px] leading-tight">
                    ₹{parseFloat(item.unitPrice).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right pr-6 md:pr-10 font-medium text-[13px] leading-tight">
                    ₹{parseFloat(item.lineTotal).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}

              {/* Totals */}
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3}></TableCell>
                <TableCell className="text-right font-semibold pt-6 text-[13px] leading-tight">
                  Gross Total:
                </TableCell>
                <TableCell className="text-right font-bold text-lg pt-6 pr-6 md:pr-10">
                  ₹{parseFloat(challan.totalAmount).toFixed(2)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {challan.notes && (
          <div className="p-6 md:p-10 border-t-[0.5px] border-border/50 bg-muted/10">
            <h3 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Notes / Terms
            </h3>
            <p className="text-[13px] leading-tight whitespace-pre-wrap">
              {challan.notes}
            </p>
          </div>
        )}
      </Card>

      {/* Actions — kept outside #challan-document so they stay out of the PDF */}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          onClick={handleDownloadPDF}
          disabled={isDownloading}
          className="rounded-[10px] h-9 shadow-sm border-[0.5px] border-border/50"
        >
          <Download
            className={`h-4 w-4 mr-2 ${isDownloading ? "animate-pulse" : ""}`}
          />
          {/* Both labels share one grid cell, so the button is always sized to
              the wider of the two and doesn't resize when a download starts. */}
          <span className="grid">
            <span
              className={`col-start-1 row-start-1 ${isDownloading ? "invisible" : ""}`}
            >
              Download PDF
            </span>
            <span
              className={`col-start-1 row-start-1 ${isDownloading ? "" : "invisible"}`}
            >
              Generating PDF...
            </span>
          </span>
        </Button>
        {canCancelUser && !isCancelled && (
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isCancelling}
            className="rounded-[10px] h-9 shadow-sm"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Cancel challan
          </Button>
        )}
        {canEdit && (
          <Link
            href={`/challans/${id}/edit`}
            onMouseEnter={prefetchEditDeps}
            onFocus={prefetchEditDeps}
          >
            <Button
              variant="outline"
              className="rounded-[10px] h-9 shadow-sm border-[0.5px] border-border/50"
            >
              <Edit className="h-4 w-4 mr-2" /> Edit draft
            </Button>
          </Link>
        )}
        {canConfirm && (
          <Button
            onClick={handleConfirm}
            disabled={isConfirming}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-[10px] h-9 shadow-sm"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm & issue
          </Button>
        )}
      </div>

      <ChallanPrintView challan={challan} />

      <AlertDialog
        open={isConfirmDialogOpen}
        onOpenChange={setIsConfirmDialogOpen}
      >
        <AlertDialogContent className="rounded-[12px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Challan?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to confirm this challan? This will deduct
              stock from your inventory and cannot be easily undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[10px]">
              Go Back
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeConfirm}
              className="rounded-[10px] bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Confirm & Issue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isCancelDialogOpen}
        onOpenChange={setIsCancelDialogOpen}
      >
        <AlertDialogContent className="rounded-[12px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Challan?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this challan? This will restore
              any deducted stock to your inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[10px]">
              Go Back
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeCancel}
              className="rounded-[10px] bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Cancel Challan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
