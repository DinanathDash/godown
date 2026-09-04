"use client";

import { useState } from "react";
import {
  useInventory,
  useAdjustStock,
  useLocations,
  useCategories,
} from "../api/inventory";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Package, Search } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { RoleGate } from "@/auth/RoleGate";

const HEAD = "text-[12px] font-medium text-muted-foreground tracking-wider";
const CARD =
  "bg-card shadow-sm border-[0.5px] border-border/50 rounded-2xl overflow-hidden";
const CONTROL = "h-9 rounded-[10px] shadow-sm border-[0.5px] border-border/50";

type Availability = "ALL" | "IN_STOCK" | "OUT_OF_STOCK";

function HeaderRow() {
  return (
    <TableRow className="bg-canvas/50 hover:bg-canvas/50 border-b-[0.5px] border-border/50">
      <TableHead className={`${HEAD} pl-5`}>SKU</TableHead>
      <TableHead className={HEAD}>Item</TableHead>
      <TableHead className={HEAD}>Location</TableHead>
      <TableHead className={HEAD}>Batch</TableHead>
      <TableHead className={`${HEAD} text-right`}>Physical</TableHead>
      <TableHead className={`${HEAD} text-right`}>Reserved</TableHead>
      <TableHead className={`${HEAD} text-right`}>Available</TableHead>
      <TableHead className={`${HEAD} text-right pr-5`}>Actions</TableHead>
    </TableRow>
  );
}

export function InventoryTable() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [locationId, setLocationId] = useState("ALL");
  const [categoryId, setCategoryId] = useState("ALL");
  const [availability, setAvailability] = useState<Availability>("ALL");

  const { data, isLoading } = useInventory({
    page,
    limit,
    search: debouncedSearch || undefined,
    locationId: locationId === "ALL" ? undefined : locationId,
    categoryId: categoryId === "ALL" ? undefined : categoryId,
    availability,
  });
  const { data: locations } = useLocations();
  const { data: categories } = useCategories();
  const adjustStock = useAdjustStock();

  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [adjustType, setAdjustType] = useState<"IN" | "OUT">("IN");
  // Held as the raw string the user typed. Storing a number here and
  // coercing on every keystroke is what stuck a leading zero to the field:
  // React compares the DOM value against the new one loosely, so "01" == 1
  // and it decides the input is already correct. Clearing the box hit the
  // same edge from the other side — Number("") is 0, which React writes
  // straight back as "0". Parse at the edges instead.
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Any filter change invalidates the current page number — page 4 of a
  // narrower result set is usually empty. Base UI's Select can emit null when
  // a value is cleared, which we treat as "no filter".
  const onFilterChange =
    (set: (v: string) => void) => (value: string | null) => {
      set(value ?? "ALL");
      setPage(1);
    };

  const isFiltered =
    debouncedSearch !== "" ||
    locationId !== "ALL" ||
    categoryId !== "ALL" ||
    availability !== "ALL";

  const clearFilters = () => {
    setSearchTerm("");
    setLocationId("ALL");
    setCategoryId("ALL");
    setAvailability("ALL");
    setPage(1);
  };

  const meta = data?.meta;
  const rows = data?.data ?? [];

  // Mirrors the server's own rules (adjustStockSchema requires a positive
  // integer quantity and a reason of 3+ characters) so the form can say what
  // is missing instead of spending a round trip to be told 400.
  const activeRow = rows.find((r) => r.id === selectedItem);
  const trimmedReason = reason.trim();
  // Number("") is 0 and Number(" ") is 0, so an empty box has to be rejected
  // before the numeric checks rather than by them.
  const quantityValue = quantity.trim() === "" ? NaN : Number(quantity);
  const validationError =
    !Number.isInteger(quantityValue) || quantityValue < 1
      ? "Enter a whole quantity of at least 1."
      : trimmedReason.length < 3
        ? "Give a reason of at least 3 characters."
        : adjustType === "OUT" &&
            activeRow &&
            quantityValue > activeRow.availableQty
          ? `Only ${activeRow.availableQty} available to remove.`
          : null;

  const handleAdjust = async () => {
    if (!selectedItem || validationError) return;
    try {
      await adjustStock.mutateAsync({
        inventoryItemId: selectedItem,
        type: adjustType,
        quantity: quantityValue,
        reason: trimmedReason,
      });
      toast.add({
        title: adjustType === "IN" ? "Stock added" : "Stock removed",
        description: `${quantityValue} ${activeRow?.item.uom ?? "units"} on ${activeRow?.item.sku ?? "this item"}.`,
      });
      setIsOpen(false);
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      // Without this the mutation rejected unhandled: the dialog stayed open,
      // nothing changed, and the reason never reached the user.
      toast.add({
        title: "Could not adjust stock",
        description:
          error.response?.data?.error?.message ?? "Please try again.",
        type: "error",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters stay mounted through loading and empty states — filtering to
          nothing must never strip away the control that undoes it. */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search item name or SKU..."
            className={`pl-9 ${CONTROL}`}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <Select
          value={locationId}
          onValueChange={onFilterChange(setLocationId)}
        >
          <SelectTrigger className={`w-[170px] ${CONTROL}`}>
            <SelectValue placeholder="Location">
              {locationId === "ALL"
                ? "All godowns"
                : locations?.find((l) => l.id === locationId)?.name ||
                  "Location"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-[10px]">
            <SelectItem value="ALL">All godowns</SelectItem>
            {locations?.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={categoryId}
          onValueChange={onFilterChange(setCategoryId)}
        >
          <SelectTrigger className={`w-[160px] ${CONTROL}`}>
            <SelectValue placeholder="Category">
              {categoryId === "ALL"
                ? "All categories"
                : categories?.find((c) => c.id === categoryId)?.name ||
                  "Category"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-[10px]">
            <SelectItem value="ALL">All categories</SelectItem>
            {categories?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={availability}
          onValueChange={onFilterChange((v) =>
            setAvailability(v as Availability),
          )}
        >
          <SelectTrigger className={`w-[165px] ${CONTROL}`}>
            <SelectValue placeholder="Availability" />
          </SelectTrigger>
          <SelectContent className="rounded-[10px]">
            <SelectItem value="ALL">Any availability</SelectItem>
            <SelectItem value="IN_STOCK">Available</SelectItem>
            <SelectItem value="OUT_OF_STOCK">Nothing available</SelectItem>
          </SelectContent>
        </Select>

        {isFiltered && (
          <Button
            variant="ghost"
            onClick={clearFilters}
            className="rounded-[10px] h-9 text-[13px] text-muted-foreground"
          >
            Clear
          </Button>
        )}
      </div>

      <div className={CARD}>
        <Table>
          <TableHeader>
            <HeaderRow />
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i} className="border-b-[0.5px] border-border/50">
                  <TableCell className="pl-5">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-44" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
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
                  <TableCell className="pr-5">
                    <Skeleton className="h-8 w-16 ml-auto rounded-[10px]" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-16 text-center">
                  <Package
                    className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3"
                    strokeWidth={1}
                  />
                  <p className="font-medium text-[13px] text-ink">
                    {isFiltered
                      ? "Nothing matches those filters"
                      : "No stock recorded yet"}
                  </p>
                  <p className="text-[13px] leading-tight text-muted-foreground mt-1">
                    {isFiltered
                      ? "Try a different godown, or clear the filters."
                      : "Inventory appears here once items are received into a godown."}
                  </p>
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              rows.map((item) => (
                <TableRow
                  key={item.id}
                  className="border-b-[0.5px] border-border/50"
                >
                  <TableCell className="font-mono font-medium text-[13px] leading-tight pl-5">
                    {item.item.sku}
                  </TableCell>
                  <TableCell className="font-medium text-ink text-[13px] leading-tight">
                    {item.item.name}
                  </TableCell>
                  <TableCell className="text-[13px] leading-tight">
                    {item.location.code}
                  </TableCell>
                  <TableCell className="text-[13px] leading-tight text-muted-foreground">
                    {item.batch.code}
                  </TableCell>
                  <TableCell className="text-right text-[13px] leading-tight tabular-nums">
                    {item.physicalQty}
                  </TableCell>
                  {/* Reserved is subtractive — read as secondary, not an alarm. */}
                  <TableCell className="text-right text-[13px] leading-tight tabular-nums text-muted-foreground">
                    {item.reservedQty}
                  </TableCell>
                  {/* Available governs every action, so it carries the
                      emphasis — and the warning when it hits zero. */}
                  <TableCell
                    className={`text-right text-[13px] leading-tight tabular-nums font-medium ${
                      item.availableQty === 0 ? "text-destructive" : "text-ink"
                    }`}
                  >
                    {item.availableQty}
                  </TableCell>
                  <TableCell className="text-right pr-5">
                    <RoleGate permission="ADJUST_INVENTORY">
                      <Dialog
                        open={isOpen && selectedItem === item.id}
                        onOpenChange={(val) => {
                          setIsOpen(val);
                          setSelectedItem(val ? item.id : null);
                          // The fields are shared by every row's dialog, so a
                          // reason typed against the last row must not ride
                          // along into this one.
                          if (val) {
                            setAdjustType("IN");
                            setQuantity("1");
                            setReason("");
                          }
                        }}
                      >
                        <DialogTrigger
                          render={
                            <Button
                              variant="outline"
                              className="rounded-[10px] h-8 text-[12px] shadow-sm border-[0.5px] border-border/50"
                            />
                          }
                        >
                          Adjust
                        </DialogTrigger>
                        <DialogContent className="rounded-2xl sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>
                              Adjust stock — {item.item.sku}
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-2">
                            <div className="flex gap-4">
                              <div className="space-y-2 flex-1">
                                <Label>Type</Label>
                                <Select
                                  value={adjustType}
                                  onValueChange={(v) =>
                                    setAdjustType(v as "IN" | "OUT")
                                  }
                                >
                                  <SelectTrigger
                                    className={`w-full ${CONTROL}`}
                                  >
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-[10px]">
                                    <SelectItem value="IN">IN</SelectItem>
                                    <SelectItem value="OUT">OUT</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2 flex-1">
                                <Label className="flex items-center justify-between">
                                  <span>Quantity</span>
                                  <span className="font-normal text-muted-foreground tabular-nums">
                                    {item.availableQty} available
                                  </span>
                                </Label>
                                <Input
                                  type="number"
                                  min="1"
                                  step="1"
                                  inputMode="numeric"
                                  className={`w-full ${CONTROL}`}
                                  value={quantity}
                                  onChange={(e) => setQuantity(e.target.value)}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Reason</Label>
                              <Input
                                placeholder="Stock count correction, damage, return…"
                                className={CONTROL}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                              />
                            </div>
                            {validationError && (
                              <p className="text-[13px] leading-tight text-muted-foreground">
                                {validationError}
                              </p>
                            )}
                            <Button
                              onClick={handleAdjust}
                              className="w-full rounded-[10px] h-9 shadow-sm"
                              disabled={
                                adjustStock.isPending ||
                                validationError !== null
                              }
                            >
                              {adjustStock.isPending
                                ? "Adjusting…"
                                : "Confirm adjustment"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </RoleGate>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {meta && meta.total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-[13px] leading-tight text-muted-foreground tabular-nums">
            Showing {(meta.page - 1) * meta.limit + 1} to{" "}
            {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} rows
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={meta.page === 1}
              className="rounded-[10px] h-9 text-[13px] shadow-sm border-[0.5px] border-border/50"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              disabled={meta.page >= meta.totalPages}
              className="rounded-[10px] h-9 text-[13px] shadow-sm border-[0.5px] border-border/50"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
