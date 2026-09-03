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

const productSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(2, "Name is required"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  unitPrice: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Must be a valid price (e.g. 10.50)"),
  minStockAlert: z.number().int().min(0, "Must be 0 or greater"),
  location: z.string().optional(),
  openingStock: z.number().int().min(0, "Must be 0 or greater").optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
}

export function ProductFormModal({
  isOpen,
  onClose,
  product,
}: ProductFormModalProps) {
  const isEditing = !!product;
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: "",
      name: "",
      description: "",
      category: "",
      unitPrice: "",
      minStockAlert: 10,
      location: "",
      openingStock: 0,
    },
  });

  useEffect(() => {
    if (product) {
      reset({
        sku: product.sku,
        name: product.name,
        description: product.description || "",
        category: product.category,
        unitPrice: product.unitPrice,
        minStockAlert: product.minStockAlert,
        location: product.location || "",
        openingStock: undefined, // Only for creation
      });
    } else {
      reset({
        sku: "",
        name: "",
        description: "",
        category: "",
        unitPrice: "",
        minStockAlert: 10,
        location: "",
        openingStock: 0,
      });
    }
  }, [product, reset]);

  const mutation = useMutation({
    mutationFn: (data: ProductFormValues) => {
      if (isEditing) {
        return productsApi.updateProduct(product.id, data);
      }
      return productsApi.createProduct(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      if (isEditing) {
        queryClient.invalidateQueries({ queryKey: ["product", product.id] });
      }
      toast.add({
        title: isEditing ? "Product updated" : "Product created",
        description: isEditing
          ? "The product has been updated successfully."
          : "A new product has been added.",
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
          error.response?.data?.error?.message || "Something went wrong.",
        type: "error",
      });
    },
  });

  const onSubmit = (data: ProductFormValues) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Product" : "Add New Product"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the product details below."
              : "Enter the details of the new product to add to inventory."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU *</Label>
              <Input id="sku" placeholder="e.g. PRD-001" {...register("sku")} />
              {errors.sku && (
                <p className="text-xs text-destructive">{errors.sku.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="Product name"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Input
                id="category"
                placeholder="Category"
                {...register("category")}
              />
              {errors.category && (
                <p className="text-xs text-destructive">
                  {errors.category.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="unitPrice">Unit Price *</Label>
              <Input
                id="unitPrice"
                placeholder="0.00"
                {...register("unitPrice")}
              />
              {errors.unitPrice && (
                <p className="text-xs text-destructive">
                  {errors.unitPrice.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minStockAlert">Min Stock Alert *</Label>
              <Input
                id="minStockAlert"
                type="number"
                {...register("minStockAlert", { valueAsNumber: true })}
              />
              {errors.minStockAlert && (
                <p className="text-xs text-destructive">
                  {errors.minStockAlert.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g. Aisle 4"
                {...register("location")}
              />
              {errors.location && (
                <p className="text-xs text-destructive">
                  {errors.location.message}
                </p>
              )}
            </div>
          </div>

          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="openingStock">Opening Stock</Label>
              <Input
                id="openingStock"
                type="number"
                {...register("openingStock", { valueAsNumber: true })}
              />
              {errors.openingStock && (
                <p className="text-xs text-destructive">
                  {errors.openingStock.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Initial stock quantity for this product.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Product description"
              {...register("description")}
              className="resize-none"
            />
            {errors.description && (
              <p className="text-xs text-destructive">
                {errors.description.message}
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
              {mutation.isPending
                ? "Saving..."
                : isEditing
                  ? "Update Product"
                  : "Add Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
