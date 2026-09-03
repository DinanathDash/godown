"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customersApi } from "@/api/customers";
import { useDebounce } from "@/hooks/useDebounce";
import { CustomerFormModal } from "@/features/customers/CustomerFormModal";
import { useAuthStore } from "@/store/useAuthStore";
import { hasPermission } from "@/auth/permissions";
import { format } from "date-fns";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Search,
  Plus,
  ArrowUpDown,
  ArrowDownAZ,
  ArrowUpAZ,
} from "lucide-react";

// Must match the sortable fields the customers API accepts.
type SortField = "name" | "businessName";
type SortOrder = "asc" | "desc";
type Sort = { field: SortField; order: SortOrder };

function SortableHead({
  field,
  label,
  className,
  sorts,
  onToggle,
}: {
  field: SortField;
  label: string;
  className?: string;
  sorts: Sort[];
  onToggle: (field: SortField) => void;
}) {
  const index = sorts.findIndex((s) => s.field === field);
  const active = index === -1 ? null : sorts[index];

  // ArrowDownAZ reads "A at the top, Z at the bottom" — that's ascending.
  // ArrowUpAZ is the reverse. Inactive columns get the neutral two-way arrow.
  const Icon = !active
    ? ArrowUpDown
    : active.order === "asc"
      ? ArrowDownAZ
      : ArrowUpAZ;

  return (
    <TableHead
      className={className}
      aria-sort={
        !active ? "none" : active.order === "asc" ? "ascending" : "descending"
      }
    >
      <button
        type="button"
        onClick={() => onToggle(field)}
        className="group inline-flex items-center gap-1.5 -mx-1 px-1 py-0.5 rounded-[6px] transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {label}
        <Icon
          className={`h-3.5 w-3.5 transition-opacity ${
            active ? "opacity-100 text-ink" : "opacity-40 group-hover:opacity-70"
          }`}
        />
        {/* Precedence only matters once a second column joins the sort. */}
        {active && sorts.length > 1 && (
          <span className="text-[10px] font-semibold leading-none text-ink tabular-nums">
            {index + 1}
          </span>
        )}
      </button>
    </TableHead>
  );
}

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const limit = 10;

  // Ordered, most significant first — the API applies them in sequence, so a
  // second column acts as the tie-break for the first.
  const [sorts, setSorts] = useState<Sort[]>([]);
  const sortParam = sorts.map((s) => `${s.field}:${s.order}`).join(",");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const user = useAuthStore((state) => state.user);

  const debouncedSearch = useDebounce(searchTerm, 350);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [
      "customers",
      {
        page,
        limit,
        q: debouncedSearch,
        status: statusFilter,
        type: typeFilter,
        sort: sortParam,
      },
    ],
    queryFn: () =>
      customersApi.getCustomers({
        page,
        limit,
        q: debouncedSearch || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        type: typeFilter === "ALL" ? undefined : typeFilter,
        sort: sortParam || undefined,
      }),
  });

  // Each column cycles asc -> desc -> off independently, and columns stack in
  // the order they were clicked, so both can be active at once. Sorting is
  // applied by the API, not to the current page, so it orders all matching
  // rows rather than just the ten on screen.
  const toggleSort = (field: SortField) => {
    setSorts((current) => {
      const existing = current.find((s) => s.field === field);
      if (!existing) return [...current, { field, order: "asc" }];
      if (existing.order === "asc") {
        return current.map((s) =>
          s.field === field ? { ...s, order: "desc" as SortOrder } : s,
        );
      }
      return current.filter((s) => s.field !== field);
    });
    setPage(1);
  };

  const canCreate = user ? hasPermission(user.role, "CREATE_CUSTOMER") : false;

  const handleNextPage = () => {
    if (data?.meta && page < data.meta.totalPages) setPage((p) => p + 1);
  };

  const handlePrevPage = () => {
    if (page > 1) setPage((p) => p - 1);
  };

  return (
    <div className="pb-8 tracking-[0.01em] space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-ink">Customers</h1>
        {canCreate && (
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-primary hover:bg-primary/90 text-white rounded-[10px] h-9 shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" /> Add customer
          </Button>
        )}
      </div>

      <div className="flex space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, mobile, email..."
            className="pl-9 h-9 rounded-[10px] shadow-sm border-[0.5px] border-border/50"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1); // reset to first page on search
            }}
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v as string);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[150px] h-9 rounded-[10px] shadow-sm border-[0.5px] border-border/50">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-[10px]">
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="LEAD">Lead</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v as string);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[150px] h-9 rounded-[10px] shadow-sm border-[0.5px] border-border/50">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent className="rounded-[10px]">
            <SelectItem value="ALL">All Types</SelectItem>
            <SelectItem value="RETAIL">Retail</SelectItem>
            <SelectItem value="WHOLESALE">Wholesale</SelectItem>
            <SelectItem value="DISTRIBUTOR">Distributor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card shadow-sm border-[0.5px] border-border/50 rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-canvas/50 border-b-[0.5px] border-border/50">
              <SortableHead
                field="name"
                label="Name"
                className="text-[12px] font-medium text-muted-foreground tracking-wider pl-5"
                sorts={sorts}
                onToggle={toggleSort}
              />
              <SortableHead
                field="businessName"
                label="Business / Mobile"
                className="text-[12px] font-medium text-muted-foreground tracking-wider"
                sorts={sorts}
                onToggle={toggleSort}
              />
              <TableHead className="text-[12px] font-medium text-muted-foreground tracking-wider">
                Type
              </TableHead>
              <TableHead className="text-[12px] font-medium text-muted-foreground tracking-wider">
                Status
              </TableHead>
              <TableHead className="text-[12px] font-medium text-muted-foreground tracking-wider">
                Follow-up
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
                    <Skeleton className="h-5 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  <TableCell className="text-right pr-5">
                    <Skeleton className="h-5 w-12 ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : isError ? (
              <TableRow className="border-b-[0.5px] border-border/50">
                <TableCell
                  colSpan={6}
                  className="text-center py-10 text-destructive text-[13px] leading-tight"
                >
                  Failed to load customers.{" "}
                  <Button
                    variant="link"
                    onClick={() => refetch()}
                    className="text-[13px] h-auto p-0"
                  >
                    Try again
                  </Button>
                </TableCell>
              </TableRow>
            ) : data?.data.length === 0 ? (
              <TableRow className="border-b-[0.5px] border-border/50">
                <TableCell
                  colSpan={6}
                  className="text-center py-10 text-muted-foreground text-[13px] leading-tight"
                >
                  No customers found.
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="hover:bg-canvas/50 transition-colors border-b-[0.5px] border-border/50"
                >
                  <TableCell className="font-medium pl-5">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="text-primary hover:underline text-[13px] leading-tight"
                    >
                      {customer.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {customer.businessName && (
                      <div className="text-[13px] leading-tight">
                        {customer.businessName}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground leading-tight">
                      {customer.mobile}
                    </div>
                  </TableCell>
                  <TableCell>
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
                      className="rounded-[6px] text-[10px] uppercase py-0"
                    >
                      {customer.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell className="text-[13px] leading-tight">
                    {customer.followUpDate
                      ? format(new Date(customer.followUpDate), "dd MMM yyyy")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right pr-5">
                    <Link
                      href={`/customers/${customer.id}`}
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                        className: "rounded-[8px] h-8 text-[12px]",
                      })}
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {data?.meta && (
          <div className="flex items-center justify-between p-4 border-t-[0.5px] border-border/50 rounded-b-2xl">
            <div className="text-sm text-muted-foreground">
              Showing {(page - 1) * limit + 1} to{" "}
              {Math.min(page * limit, data.meta.total)} of {data.meta.total}{" "}
              results
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={handlePrevPage}
                className="rounded-[10px] shadow-sm border-[0.5px] border-border/50"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.meta.totalPages}
                onClick={handleNextPage}
                className="rounded-[10px] shadow-sm border-[0.5px] border-border/50"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <CustomerFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
