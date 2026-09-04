import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useCreateOrder,
  useLocations,
  useItems,
  useCustomers,
} from "../api/orders";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";

const schema = z.object({
  customerId: z.string().uuid(),
  locationId: z.string().uuid(),
  lines: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        quantity: z.coerce.number().int().min(1),
      }),
    )
    .min(1, "At least one line item is required"),
});

type FormValues = z.infer<typeof schema>;

export function CreateOrderDialog() {
  const [open, setOpen] = useState(false);
  const createMutation = useCreateOrder();
  const { data: locationsData } = useLocations();
  const { data: itemsData } = useItems();
  const { data: customersData } = useCustomers();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      lines: [{ itemId: "", quantity: 1 as unknown as number }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lines",
  });

  const onSubmit = async (data: FormValues) => {
    try {
      await createMutation.mutateAsync(data);
      reset();
      setOpen(false);
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      window.alert(
        e.response?.data?.error?.message || "Failed to create order",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Create Order
          </Button>
        }
      />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Customer Order</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Customer</label>
              <select
                {...register("customerId")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select Customer</option>
                {customersData?.map(
                  (customer: { id: string; name: string }) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ),
                )}
              </select>
              {errors.customerId && (
                <p className="text-xs text-red-500">
                  {errors.customerId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Fulfillment Location
              </label>
              <select
                {...register("locationId")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select Location</option>
                {locationsData?.map(
                  (loc: { id: string; name: string; code: string }) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.code}
                    </option>
                  ),
                )}
              </select>
              {errors.locationId && (
                <p className="text-xs text-red-500">
                  {errors.locationId.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Line Items</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({ itemId: "", quantity: 1 as unknown as number })
                }
              >
                <Plus className="h-4 w-4 mr-2" /> Add Item
              </Button>
            </div>

            {errors.lines?.root && (
              <p className="text-xs text-red-500">
                {errors.lines.root.message}
              </p>
            )}

            <div className="space-y-2">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <select
                      {...register(`lines.${index}.itemId` as const)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Select Item</option>
                      {itemsData?.map(
                        (item: { id: string; name: string; sku: string }) => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({item.sku})
                          </option>
                        ),
                      )}
                    </select>
                    {errors.lines?.[index]?.itemId && (
                      <p className="text-xs text-red-500">
                        {errors.lines[index]?.itemId?.message}
                      </p>
                    )}
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      {...register(`lines.${index}.quantity` as const)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Qty"
                    />
                    {errors.lines?.[index]?.quantity && (
                      <p className="text-xs text-red-500">
                        {errors.lines[index]?.quantity?.message}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Order"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
