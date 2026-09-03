"use client";

import { useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customersApi } from "@/api/customers";
import { productsApi } from "@/api/products";
import { challansApi } from "@/api/challans";
import { Challan } from "@/types/api";
import { toast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const challanItemSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitPrice: z.number().min(0, "Unit price cannot be negative"),
});

const challanSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  notes: z.string().optional(),
  items: z.array(challanItemSchema).min(1, "At least one item is required"),
});

type ChallanFormValues = z.infer<typeof challanSchema>;

interface ChallanFormProps {
  initialData?: Challan;
  isEdit?: boolean;
}

export function ChallanForm({ initialData, isEdit }: ChallanFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [customerOpen, setCustomerOpen] = useState(false);

  // Fetch customers (active ones ideally, but let's get all for now, could filter to ACTIVE later)
  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ["customers", { limit: 1000 }],
    queryFn: () => customersApi.getCustomers({ limit: 1000 }),
  });
  const customers = customersData?.data || [];

  // Fetch products (with limit 1000 for dropdown)
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["products", { limit: 1000 }],
    queryFn: () => productsApi.getProducts({ limit: 1000 }),
  });
  const products = productsData?.data || [];

  // Both queries back the customer combobox and every product select below —
  // rendering the real form before they resolve shows working-looking inputs
  // with no options yet (e.g. a selected product falling back to "Select a
  // product..." because `products` is still empty), which reads as broken
  // rather than loading. Show a matching skeleton instead.
  const depsLoading = customersLoading || productsLoading;

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ChallanFormValues>({
    resolver: zodResolver(challanSchema),
    defaultValues: {
      customerId: initialData?.customerId || "",
      notes: initialData?.notes || "",
      items: initialData?.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: parseFloat(i.unitPrice),
      })) || [{ productId: "", quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const customerId = watch("customerId");
  const items = watch("items");

  const createMutation = useMutation({
    mutationFn: (data: { values: ChallanFormValues; confirm: boolean }) =>
      challansApi.createChallan({
        ...data.values,
        status: data.confirm ? "CONFIRMED" : "DRAFT",
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["challans"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.add({
        title: "Challan created",
        description: "The challan has been created successfully.",
      });
      router.push(`/challans/${res.id}`);
    },
    onError: (err: unknown) => {
      const error = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      toast.add({
        title: "Error",
        description:
          error.response?.data?.error?.message || "Failed to create challan.",
        type: "error",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { values: ChallanFormValues; confirm: boolean }) => {
      if (!initialData) throw new Error("No initial data");
      // If they click confirm, we might need to update first then confirm, or backend might handle it.
      // Assuming backend PATCH /challans/:id just updates.
      // If we need to confirm, we call confirmChallan API.
      return challansApi.updateChallan(initialData.id, {
        ...data.values,
        status: data.confirm ? "CONFIRMED" : "DRAFT",
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["challans"] });
      queryClient.invalidateQueries({ queryKey: ["challan", initialData?.id] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.add({
        title: "Challan updated",
        description: "The challan has been updated successfully.",
      });
      router.push(`/challans/${res.id}`);
    },
    onError: (err: unknown) => {
      const error = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      toast.add({
        title: "Error",
        description:
          error.response?.data?.error?.message || "Failed to update challan.",
        type: "error",
      });
    },
  });

  const onSubmit = (data: ChallanFormValues, confirm: boolean) => {
    // Validate quantities against stock if confirming
    if (confirm) {
      for (const item of data.items) {
        const product = products.find((p) => p.id === item.productId);
        if (product && item.quantity > product.currentStock) {
          toast.add({
            title: "Insufficient Stock",
            description: `Cannot confirm: ${product.name} has only ${product.currentStock} in stock, but ${item.quantity} requested.`,
            type: "error",
          });
          return;
        }
      }
    }

    if (isEdit) {
      updateMutation.mutate({ values: data, confirm });
    } else {
      createMutation.mutate({ values: data, confirm });
    }
  };

  const calculateTotal = () => {
    return items.reduce(
      (total, item) => total + (item.quantity || 0) * (item.unitPrice || 0),
      0,
    );
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (depsLoading) {
    return <ChallanFormSkeleton rowCount={initialData?.items.length} />;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          {isEdit ? "Edit Draft Challan" : "Create New Challan"}
        </CardTitle>
        <CardDescription>
          Select a customer and add product line items.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2 max-w-sm">
          <Label>Customer *</Label>
          <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerOpen}
                  className="w-full justify-between"
                />
              }
            >
              {customerId
                ? customers.find((customer) => customer.id === customerId)
                    ?.name || "Unknown Customer"
                : "Select customer..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <Command>
                <CommandInput placeholder="Search customer..." />
                <CommandList>
                  <CommandEmpty>No customer found.</CommandEmpty>
                  <CommandGroup>
                    {customers.map((customer) => (
                      <CommandItem
                        key={customer.id}
                        value={customer.name}
                        onSelect={() => {
                          setValue("customerId", customer.id, {
                            shouldValidate: true,
                          });
                          setCustomerOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            customerId === customer.id
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        {customer.name}{" "}
                        {customer.businessName
                          ? `(${customer.businessName})`
                          : ""}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {errors.customerId && (
            <p className="text-xs text-destructive">
              {errors.customerId.message}
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label className="text-base">Line Items *</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({ productId: "", quantity: 1, unitPrice: 0 })
              }
            >
              <Plus className="h-4 w-4 mr-2" /> Add Item
            </Button>
          </div>
          {errors.items?.root && (
            <p className="text-xs text-destructive">
              {errors.items.root.message}
            </p>
          )}

          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[40%]">Product</TableHead>
                  <TableHead>Available Stock</TableHead>
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead className="w-32">Unit Price</TableHead>
                  <TableHead className="w-32">Total</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const currentProductId = items[index]?.productId;
                  const selectedProduct = products.find(
                    (p) => p.id === currentProductId,
                  );
                  const qty = items[index]?.quantity || 0;
                  const price = items[index]?.unitPrice || 0;

                  return (
                    <TableRow key={field.id}>
                      <TableCell>
                        <Controller
                          name={`items.${index}.productId`}
                          control={control}
                          render={({ field }) => (
                            <Select
                              onValueChange={(value) => {
                                field.onChange(value);
                                const p = products.find(
                                  (prod) => prod.id === value,
                                );
                                if (p) {
                                  setValue(
                                    `items.${index}.unitPrice`,
                                    parseFloat(p.unitPrice),
                                  );
                                }
                              }}
                              value={field.value}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a product...">
                                  {field.value && products.length > 0
                                    ? (() => {
                                        const p = products.find(
                                          (prod) => prod.id === field.value,
                                        );
                                        return p
                                          ? `${p.name} (${p.sku})`
                                          : "Select a product...";
                                      })()
                                    : "Select a product..."}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} ({p.sku})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {errors.items?.[index]?.productId && (
                          <p className="text-xs text-destructive mt-1">
                            {errors.items[index]?.productId?.message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {selectedProduct ? (
                          <span
                            className={
                              selectedProduct.currentStock <=
                              selectedProduct.minStockAlert
                                ? "text-destructive font-medium"
                                : ""
                            }
                          >
                            {selectedProduct.currentStock}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-9"
                          {...register(`items.${index}.quantity`, {
                            valueAsNumber: true,
                          })}
                        />
                        {errors.items?.[index]?.quantity && (
                          <p className="text-xs text-destructive mt-1">
                            {errors.items[index]?.quantity?.message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          className="h-9"
                          {...register(`items.${index}.unitPrice`, {
                            valueAsNumber: true,
                          })}
                        />
                        {errors.items?.[index]?.unitPrice && (
                          <p className="text-xs text-destructive mt-1">
                            {errors.items[index]?.unitPrice?.message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        ₹{(qty * price).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end pt-4">
            <div className="text-right">
              <span className="text-muted-foreground mr-4">Gross Total:</span>
              <span className="text-2xl font-bold">
                ₹{calculateTotal().toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Internal Notes (Optional)</Label>
          <Textarea
            id="notes"
            placeholder="Any special instructions or notes..."
            {...register("notes")}
            className="resize-none"
          />
        </div>
      </CardContent>
      <CardFooter className="flex justify-between border-t p-6">
        <Button
          variant="outline"
          type="button"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
        <div className="flex space-x-3">
          <Button
            variant="secondary"
            onClick={handleSubmit((data) => onSubmit(data, false))}
            disabled={isPending}
          >
            Save as Draft
          </Button>
          <Button
            onClick={handleSubmit((data) => onSubmit(data, true))}
            disabled={isPending}
          >
            Save & Confirm
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

// Mirrors ChallanForm's real layout exactly, so there's no visible jump
// between "challan is loading" (EditChallanPage, before this component even
// mounts) and "customers/products are loading" (this component's own
// depsLoading branch above) — same skeleton either way.
export function ChallanFormSkeleton({ rowCount = 3 }: { rowCount?: number }) {
  return (
    <Card className="w-full">
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2 max-w-sm">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-full" />
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-28" />
          </div>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[40%]">Product</TableHead>
                  <TableHead>Available Stock</TableHead>
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead className="w-32">Unit Price</TableHead>
                  <TableHead className="w-32">Total</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: rowCount }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-9 w-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-8" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-9 w-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-9 w-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-8" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end pt-4">
            <Skeleton className="h-8 w-40" />
          </div>
        </div>

        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-20 w-full" />
        </div>
      </CardContent>
      <CardFooter className="flex justify-between border-t p-6">
        <Skeleton className="h-9 w-20" />
        <div className="flex space-x-3">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </CardFooter>
    </Card>
  );
}
