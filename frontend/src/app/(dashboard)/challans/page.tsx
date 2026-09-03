"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { challansApi } from "@/api/challans";
import { useDebounce } from "@/hooks/useDebounce";
import { format } from "date-fns";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { Plus, Search, FileText } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";

export default function ChallanListPage() {
  const user = useAuthStore((state) => state.user);
  const canCreate = user?.role === "ADMIN" || user?.role === "SALES";
  const queryClient = useQueryClient();

  // Warm the detail query on hover so the modal usually opens with cached
  // data instead of showing its loading skeleton.
  const prefetchChallan = (id: string) => {
    queryClient
      .query({
        queryKey: ["challan", id],
        queryFn: () => challansApi.getChallan(id),
      })
      .catch(() => {});
  };

  const [page, setPage] = useState(1);
  const limit = 10;

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const { data, isLoading } = useQuery({
    queryKey: [
      "challans",
      {
        page,
        limit,
        q: debouncedSearch,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
      },
    ],
    queryFn: () =>
      challansApi.getChallans({
        page,
        limit,
        q: debouncedSearch || undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
      }),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return (
          <Badge variant="neutral" className="rounded-[6px]">
            Draft
          </Badge>
        );
      case "CONFIRMED":
        return (
          <Badge variant="success" className="rounded-[6px]">
            Confirmed
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
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="pb-8 tracking-[0.01em] space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Sales Challans
          </h1>
          <p className="text-muted-foreground text-[13px] leading-tight">
            Manage delivery challans and shipments.
          </p>
        </div>
        {canCreate && (
          <Link href="/challans/new">
            <Button className="rounded-[10px] h-9 shadow-sm">
              <Plus className="mr-2 h-4 w-4" /> Create challan
            </Button>
          </Link>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-4 shadow-sm border-[0.5px] border-border/50 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by Challan # or Customer..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="pl-9 h-9 rounded-[10px] shadow-sm border-[0.5px] border-border/50"
          />
        </div>

        <div className="w-full sm:w-48">
          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val || "ALL");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[150px] h-9 rounded-[10px] shadow-sm border-[0.5px] border-border/50">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="rounded-[10px]">
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="CONFIRMED">Confirmed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-card shadow-sm border-[0.5px] border-border/50 rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-canvas/50 hover:bg-canvas/50 border-b-[0.5px] border-border/50">
              <TableHead className="w-[120px] text-[12px] font-medium text-muted-foreground tracking-wider pl-5">
                Challan No.
              </TableHead>
              <TableHead className="text-[12px] font-medium text-muted-foreground tracking-wider">
                Date
              </TableHead>
              <TableHead className="text-[12px] font-medium text-muted-foreground tracking-wider">
                Customer
              </TableHead>
              <TableHead className="text-right text-[12px] font-medium text-muted-foreground tracking-wider">
                Items
              </TableHead>
              <TableHead className="text-right text-[12px] font-medium text-muted-foreground tracking-wider">
                Total Amount
              </TableHead>
              <TableHead className="w-[120px] text-center text-[12px] font-medium text-muted-foreground tracking-wider">
                Status
              </TableHead>
              <TableHead className="text-right text-[12px] font-medium text-muted-foreground tracking-wider pr-5">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-b-[0.5px] border-border/50">
                  <TableCell className="pl-5">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-4 w-8 ml-auto" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-4 w-16 ml-auto" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="h-6 w-16 mx-auto" />
                  </TableCell>
                  <TableCell className="pr-5">
                    <Skeleton className="h-8 w-16 ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : data?.data.length === 0 ? (
              <TableRow className="border-b-[0.5px] border-border/50">
                <TableCell
                  colSpan={7}
                  className="text-center py-10 text-muted-foreground"
                >
                  <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                  <span className="text-[13px] leading-tight">
                    No challans found matching your criteria.
                  </span>
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((challan) => (
                <TableRow
                  key={challan.id}
                  className="hover:bg-canvas/50 transition-colors border-b-[0.5px] border-border/50"
                >
                  <TableCell className="font-mono font-medium text-[13px] leading-tight pl-5">
                    {challan.challanNumber || (
                      <span className="text-muted-foreground text-xs italic">
                        Draft
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-[13px] leading-tight">
                    {format(new Date(challan.createdAt), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-ink text-[13px] leading-tight">
                      {challan.customerSnapshot?.name || "Unknown"}
                    </div>
                    {challan.customerSnapshot?.businessName && (
                      <div className="text-xs text-muted-foreground leading-tight mt-0.5">
                        {challan.customerSnapshot.businessName}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-[13px] leading-tight">
                    {challan._count?.items ?? challan.items?.length ?? 0}
                  </TableCell>
                  <TableCell className="text-right font-medium text-[13px] leading-tight">
                    ₹{parseFloat(challan.totalAmount).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(challan.status)}
                  </TableCell>
                  <TableCell className="text-right pr-5">
                    <Link
                      href={`/challans/${challan.id}`}
                      onMouseEnter={() => prefetchChallan(challan.id)}
                      onFocus={() => prefetchChallan(challan.id)}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-[8px] h-8 text-[12px]"
                      >
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data?.meta && data.meta.totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-[10px] shadow-sm border-[0.5px] border-border/50"
              >
                Previous
              </Button>
            </PaginationItem>
            <PaginationItem>
              <span className="text-[13px] leading-tight text-muted-foreground mx-4">
                Page {page} of {data.meta.totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setPage((p) => Math.min(data.meta.totalPages, p + 1))
                }
                disabled={page === data.meta.totalPages}
                className="rounded-[10px] shadow-sm border-[0.5px] border-border/50"
              >
                Next
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
