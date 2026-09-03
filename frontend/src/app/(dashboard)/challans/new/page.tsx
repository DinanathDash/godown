"use client";

import { ChallanForm } from "@/features/challans/ChallanForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NewChallanPage() {
  return (
    <div className="pb-8 tracking-[0.01em] space-y-8 max-w-5xl mx-auto">
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
          <h1 className="text-2xl font-bold text-ink">New Challan</h1>
          <p className="text-[13px] leading-tight text-muted-foreground mt-1">
            Draft a new delivery challan or invoice.
          </p>
        </div>
      </div>

      <ChallanForm />
    </div>
  );
}
