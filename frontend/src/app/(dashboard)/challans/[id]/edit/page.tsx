"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { challansApi } from "@/api/challans";
import {
  ChallanForm,
  ChallanFormSkeleton,
} from "@/features/challans/ChallanForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditChallanPage() {
  const params = useParams();
  const id = params.id as string;

  const {
    data: challan,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["challan", id],
    queryFn: () => challansApi.getChallan(id),
  });

  if (isLoading) {
    return (
      <div className="pb-8 tracking-[0.01em] space-y-8 max-w-5xl mx-auto">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-9 w-9 rounded-[10px]" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <ChallanFormSkeleton />
      </div>
    );
  }

  if (isError || !challan || challan.status !== "DRAFT") {
    return (
      <div className="text-center py-20 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-ink mb-2">
          Cannot Edit Challan
        </h2>
        <p className="text-muted-foreground mb-6">
          This challan either does not exist or is no longer in DRAFT status.
        </p>
        <Link
          href={`/challans/${id}`}
          className={buttonVariants({ variant: "default" })}
        >
          View Challan Details
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-8 tracking-[0.01em] space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center space-x-4">
        <Link
          href={`/challans/${id}`}
          className={buttonVariants({
            variant: "ghost",
            size: "icon",
            className: "rounded-[10px]",
          })}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-ink">
            Edit Draft: {challan.challanNumber || "Unnumbered"}
          </h1>
          <p className="text-[13px] leading-tight text-muted-foreground mt-1">
            Make changes before confirming.
          </p>
        </div>
      </div>

      <ChallanForm initialData={challan} isEdit={true} />
    </div>
  );
}
