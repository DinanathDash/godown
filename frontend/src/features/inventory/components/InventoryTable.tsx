"use client";

import { useState } from "react";
import { useInventory, useAdjustStock } from "../api/inventory";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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

  if (isLoading) return <Skeleton className="h-[400px] w-full" />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SKU</TableHead>
            <TableHead>Item Name</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Batch</TableHead>
            <TableHead className="text-right">Physical</TableHead>
            <TableHead className="text-right">Reserved</TableHead>
            <TableHead className="text-right">Available</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.data.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.item.sku}</TableCell>
              <TableCell>{item.item.name}</TableCell>
              <TableCell>{item.location.code}</TableCell>
              <TableCell>{item.batch.code}</TableCell>
              <TableCell className="text-right">{item.physicalQty}</TableCell>
              <TableCell className="text-right text-orange-600">{item.reservedQty}</TableCell>
              <TableCell className="text-right font-bold text-green-600">{item.availableQty}</TableCell>
              <TableCell>
                <Dialog open={isOpen && selectedItem === item.id} onOpenChange={(val) => {
                  setIsOpen(val);
                  if (val) setSelectedItem(item.id);
                  else setSelectedItem(null);
                }}>
                  <DialogTrigger>
                    <Button variant="outline" size="sm">Adjust</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adjust Stock for {item.item.sku}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select value={adjustType} onValueChange={(v) => setAdjustType(v as "IN" | "OUT")}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="IN">IN (+)</SelectItem>
                            <SelectItem value="OUT">OUT (-)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Reason</Label>
                        <Input placeholder="E.g., Manual Adjustment, Damage, etc." value={reason} onChange={(e) => setReason(e.target.value)} />
                      </div>
                      <Button onClick={handleAdjust} className="w-full" disabled={adjustStock.isPending}>
                        {adjustStock.isPending ? "Adjusting..." : "Confirm"}
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
