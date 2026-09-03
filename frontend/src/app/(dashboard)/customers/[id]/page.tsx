"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customersApi } from "@/api/customers";
import { useAuthStore } from "@/store/useAuthStore";
import { hasPermission } from "@/auth/permissions";
import { format } from "date-fns";
import Link from "next/link";

import { CustomerFormModal } from "@/features/customers/CustomerFormModal";
import { FollowUpNoteForm } from "@/features/customers/FollowUpNoteForm";
import { toast } from "@/components/ui/toast";

import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  ArrowLeft,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Building,
  CreditCard,
  Hash,
} from "lucide-react";

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => customersApi.getCustomer(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => customersApi.deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.add({
        title: "Customer deleted",
        description: "The customer has been successfully deleted.",
      });
      router.push("/customers");
    },
    onError: (err: unknown) => {
      const error = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      toast.add({
        title: "Delete failed",
        description:
          error.response?.data?.error?.message || "Could not delete customer.",
        type: "error",
      });
      setIsDeleting(false);
    },
  });

  const confirmDelete = () => {
    setIsDeleting(true);
    deleteMutation.mutate();
    setIsDeleteDialogOpen(false);
  };

  const handleDelete = () => {
    setIsDeleteDialogOpen(true);
  };

  const canEdit = user ? hasPermission(user.role, "UPDATE_CUSTOMER") : false;
  const canDelete = user ? hasPermission(user.role, "DELETE_CUSTOMER") : false;
  const canAddNote = user
    ? hasPermission(user.role, "ADD_CUSTOMER_NOTE")
    : false;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-1 space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="col-span-1 md:col-span-2 space-y-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data?.customer) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-ink mb-2">Customer Not Found</h2>
        <p className="text-muted-foreground mb-6">
          The customer you are looking for doesn&apos;t exist or has been
          deleted.
        </p>
        <Link
          href="/customers"
          className={buttonVariants({ variant: "default" })}
        >
          Back to Customers
        </Link>
      </div>
    );
  }

  const { customer, recentNotes, recentChallans } = data;

  return (
    <div className="pb-8 tracking-[0.01em] space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/customers"
            className={buttonVariants({
              variant: "ghost",
              size: "icon",
              className: "rounded-[10px]",
            })}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-ink">{customer.name}</h1>
          <Badge
            variant={
              customer.status === "ACTIVE"
                ? "success"
                : customer.status === "LEAD"
                  ? "warning"
                  : "neutral"
            }
            className="rounded-[6px]"
          >
            {customer.status}
          </Badge>
          <Badge
            variant={
              customer.type === "RETAIL"
                ? "info"
                : customer.type === "WHOLESALE"
                  ? "purple"
                  : customer.type === "DISTRIBUTOR"
                    ? "warning"
                    : "neutral"
            }
            className="rounded-[6px]"
          >
            {customer.type}
          </Badge>
        </div>

        <div className="flex space-x-2">
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(true)}
              className="rounded-[10px] h-9 shadow-sm border-[0.5px] border-border/50"
            >
              <Edit2 className="h-4 w-4 mr-2" /> Edit
            </Button>
          )}
          {canDelete && (
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10 border-destructive/20 rounded-[10px] h-9 shadow-sm border-[0.5px]"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />{" "}
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Profile & Challans */}
        <div className="col-span-1 space-y-6">
          <Card className="shadow-sm border-[0.5px] border-border/50 rounded-2xl bg-card">
            <CardHeader className="pb-3 border-b-[0.5px] border-border/50 bg-canvas/30">
              <CardTitle className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {customer.businessName && (
                <div className="flex items-start text-[13px] leading-tight">
                  <Building className="h-4 w-4 text-muted-foreground mr-3 mt-0.5 shrink-0" />
                  <span className="text-ink">{customer.businessName}</span>
                </div>
              )}
              <div className="flex items-start text-[13px] leading-tight">
                <Phone className="h-4 w-4 text-muted-foreground mr-3 mt-0.5 shrink-0" />
                <span className="text-ink">{customer.mobile}</span>
              </div>
              {customer.email && (
                <div className="flex items-start text-[13px] leading-tight">
                  <Mail className="h-4 w-4 text-muted-foreground mr-3 mt-0.5 shrink-0" />
                  <span className="text-ink">{customer.email}</span>
                </div>
              )}
              {customer.address && (
                <div className="flex items-start text-[13px] leading-tight">
                  <MapPin className="h-4 w-4 text-muted-foreground mr-3 mt-0.5 shrink-0" />
                  <span className="text-ink">{customer.address}</span>
                </div>
              )}
              {customer.gstin && (
                <div className="flex items-start text-[13px] leading-tight">
                  <Hash className="h-4 w-4 text-muted-foreground mr-3 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-muted-foreground block text-[12px]">
                      GSTIN
                    </span>
                    <span className="text-ink">{customer.gstin}</span>
                  </div>
                </div>
              )}
              <div className="flex items-start text-[13px] leading-tight pt-4 border-t-[0.5px] border-border/50">
                <CreditCard className="h-4 w-4 text-muted-foreground mr-3 mt-0.5 shrink-0" />
                <div>
                  <span className="text-muted-foreground block text-[12px]">
                    Credit Limit / Balance
                  </span>
                  <span className="text-ink font-medium font-mono tabular-nums">
                    ₹{customer.creditLimit} / ₹{customer.balance}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-[0.5px] border-border/50 rounded-2xl bg-card">
            <CardHeader className="pb-3 border-b-[0.5px] border-border/50 bg-canvas/30">
              <CardTitle className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
                Recent Challans
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {recentChallans && recentChallans.length > 0 ? (
                <div className="divide-y divide-border/50 border-t-0">
                  {recentChallans.map((challan) => (
                    <div
                      key={challan.id}
                      className="p-4 hover:bg-canvas/50 transition-colors"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <Link
                          href={`/challans/${challan.id}`}
                          className="text-[13px] font-medium text-primary hover:underline leading-tight"
                        >
                          {challan.challanNumber || "Draft"}
                        </Link>
                        <Badge
                          variant={
                            challan.status === "CONFIRMED"
                              ? "success"
                              : challan.status === "DRAFT"
                                ? "neutral"
                                : "destructive"
                          }
                          className="text-[10px] uppercase py-0 rounded-[6px]"
                        >
                          {challan.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center text-[12px] text-muted-foreground">
                        <span>
                          {format(new Date(challan.createdAt), "dd MMM yyyy")}
                        </span>
                        <span className="font-mono tabular-nums text-ink">
                          ₹{challan.totalAmount}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-[13px] text-muted-foreground">
                  No challans found for this customer.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Notes Timeline */}
        <div className="col-span-1 lg:col-span-2 space-y-6">
          {canAddNote && (
            <FollowUpNoteForm
              customerId={customer.id}
              currentStatus={customer.status}
            />
          )}

          <Card className="shadow-sm border-[0.5px] border-border/50 rounded-2xl bg-card">
            <CardHeader className="pb-3 border-b-[0.5px] border-border/50 bg-canvas/30">
              <CardTitle className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
                Timeline & Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {recentNotes && recentNotes.length > 0 ? (
                <div className="relative border-l-[0.5px] border-border/50 ml-3 space-y-8 pb-4">
                  {recentNotes.map((note) => (
                    <div key={note.id} className="relative pl-6">
                      {/* Timeline dot */}
                      <span className="absolute -left-1.5 top-8 h-3 w-3 rounded-full bg-primary ring-4 ring-card" />

                      <div className="bg-canvas/50 rounded-2xl p-4 border-[0.5px] border-border/50 text-[13px] shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-medium text-ink">
                              {note.createdBy.name}
                            </span>
                            <span className="text-muted-foreground ml-2 text-[12px]">
                              {format(
                                new Date(note.createdAt),
                                "dd MMM yyyy, HH:mm",
                              )}
                            </span>
                          </div>
                          {note.followUpDate && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] bg-accent/10 text-accent hover:bg-accent/20 rounded-[6px]"
                            >
                              Follow up:{" "}
                              {format(
                                new Date(note.followUpDate),
                                "dd MMM yyyy",
                              )}
                            </Badge>
                          )}
                        </div>
                        <p className="text-ink whitespace-pre-wrap leading-tight">
                          {note.note}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground text-[13px] leading-tight">
                  <p>No notes or history available.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <CustomerFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        customer={customer}
      />

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent className="rounded-[12px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this
              customer from your database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[10px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="rounded-[10px] bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Customer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
