"use client";

import { useState } from "react";
import { useInventory, useAdjustStock } from "../api/inventory";
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
import { Package } from "lucide-react";

const HEAD = "text-[12px] font-medium text-muted-foreground tracking-wider";
const CARD =
  "bg-card shadow-sm border-[0.5px] border-border/50 rounded-2xl overflow-hidden";

export function InventoryTable() {
  const { data, isLoading } = useInventory({ page: 1, limit: 50 });
  const adjustStock = useAdjustStock();
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [adjustType, setAdjustType] = useState<"IN" | "OUT">("IN");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleAdjust = async () => {
    if (!selectedItem) return;
    await adjustStock.mutateAsync({
      inventoryItemId: selectedItem,
      type: adjustType,
      quantity: Number(quantity),
      reason,
    });
    setIsOpen(false);
  };

  // Skeleton mirrors the real row shape so nothing shifts when data lands.
  if (isLoading) {
    return (
      <div className={CARD}>
        <Table>
          <TableHeader>
            <TableRow className="bg-canvas/50 border-b-[0.5px] border-border/50">
              <TableHead className={`${HEAD} pl-5`}>SKU</TableHead>
              <TableHead className={HEAD}>Item</TableHead>
              <TableHead className={HEAD}>Location</TableHead>
              <TableHead className={HEAD}>Batch</TableHead>
              <TableHead className={`${HEAD} text-right`}>Physical</TableHead>
              <TableHead className={`${HEAD} text-right`}>Reserved</TableHead>
              <TableHead className={`${HEAD} text-right`}>Available</TableHead>
              <TableHead className={`${HEAD} text-right pr-5`}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i} className="border-b-[0.5px] border-border/50">
                <TableCell className="pl-5"><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-44" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-10 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-4 w-10 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-4 w-10 ml-auto" /></TableCell>
                <TableCell className="pr-5"><Skeleton className="h-8 w-16 ml-auto rounded-[10px]" /></TableCell>
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
        <Package
          className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3"
          strokeWidth={1}
        />
        <p className="font-medium text-[13px] text-ink">No stock recorded yet</p>
        <p className="text-[13px] leading-tight text-muted-foreground mt-1">
          Inventory appears here once items are received into a godown.
        </p>
      </div>
    );
  }

  return (
    <div className={CARD}>
      <Table>
        <TableHeader>
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
        </TableHeader>
        <TableBody>
          {data.data.map((item) => (
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
              {/* Reserved is subtractive — read as secondary, not as an alarm. */}
              <TableCell className="text-right text-[13px] leading-tight tabular-nums text-muted-foreground">
                {item.reservedQty}
              </TableCell>
              {/* Available is the number that governs every action, so it
                  carries the emphasis — and the warning when it hits zero. */}
              <TableCell
                className={`text-right text-[13px] leading-tight tabular-nums font-medium ${
                  item.availableQty === 0 ? "text-destructive" : "text-ink"
                }`}
              >
                {item.availableQty}
              </TableCell>
              <TableCell className="text-right pr-5">
                <Dialog
                  open={isOpen && selectedItem === item.id}
                  onOpenChange={(val) => {
                    setIsOpen(val);
                    if (val) setSelectedItem(item.id);
                    else setSelectedItem(null);
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
                  <DialogContent className="rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>Adjust stock — {item.item.sku}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select
                          value={adjustType}
                          onValueChange={(v) => setAdjustType(v as "IN" | "OUT")}
                        >
                          <SelectTrigger className="h-9 rounded-[10px] shadow-sm border-[0.5px] border-border/50">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent className="rounded-[10px]">
                            <SelectItem value="IN">IN — add stock</SelectItem>
                            <SelectItem value="OUT">OUT — remove stock</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          className="h-9 rounded-[10px] shadow-sm border-[0.5px] border-border/50"
                          value={quantity}
                          onChange={(e) => setQuantity(Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Reason</Label>
                        <Input
                          placeholder="Stock count correction, damage, return…"
                          className="h-9 rounded-[10px] shadow-sm border-[0.5px] border-border/50"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={handleAdjust}
                        className="w-full rounded-[10px] h-9 shadow-sm"
                        disabled={adjustStock.isPending}
                      >
                        {adjustStock.isPending ? "Adjusting…" : "Confirm adjustment"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
