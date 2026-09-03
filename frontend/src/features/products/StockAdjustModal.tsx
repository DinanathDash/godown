import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { productsApi } from "@/api/products";
import { Product } from "@/types/api";
import { toast } from "@/components/ui/toast";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const adjustSchema = z.object({
  type: z.enum(["IN", "OUT"]),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  reason: z.string().min(3, "Reason is required"),
});

type AdjustFormValues = z.infer<typeof adjustSchema>;

interface StockAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
}

export function StockAdjustModal({
  isOpen,
  onClose,
  product,
}: StockAdjustModalProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AdjustFormValues>({
    resolver: zodResolver(adjustSchema),
    defaultValues: {
      type: "IN",
      quantity: 1,
      reason: "",
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const typeValue = watch("type");

  useEffect(() => {
    if (isOpen) {
      reset({
        type: "IN",
        quantity: 1,
        reason: "",
      });
    }
  }, [isOpen, reset]);

  const mutation = useMutation({
    mutationFn: (data: AdjustFormValues) => {
      if (!product) throw new Error("No product selected");
      return productsApi.adjustStock(product.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      if (product) {
        queryClient.invalidateQueries({ queryKey: ["product", product.id] });
      }
      toast.add({
        title: "Stock adjusted",
        description: "The stock movement was recorded successfully.",
      });
      onClose();
    },
    onError: (err: unknown) => {
      const error = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      toast.add({
        title: "Error",
        description:
          error.response?.data?.error?.message || "Failed to adjust stock.",
        type: "error",
      });
    },
  });

  const onSubmit = (data: AdjustFormValues) => {
    mutation.mutate(data);
  };

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>
            Record a stock movement for <strong>{product.name}</strong>{" "}
            (Current: {product.currentStock}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Movement Type</Label>
              <Select
                value={typeValue}
                onValueChange={(val) => setValue("type", val as "IN" | "OUT")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">Stock In (+)</SelectItem>
                  <SelectItem value="OUT">Stock Out (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                {...register("quantity", { valueAsNumber: true })}
              />
              {errors.quantity && (
                <p className="text-xs text-destructive">
                  {errors.quantity.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Textarea
              id="reason"
              placeholder="e.g. Received new shipment, Damaged goods, Audit adjustment..."
              {...register("reason")}
              className="resize-none"
            />
            {errors.reason && (
              <p className="text-xs text-destructive">
                {errors.reason.message}
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Confirm Adjustment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
