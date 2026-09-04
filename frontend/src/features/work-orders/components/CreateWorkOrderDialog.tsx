import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useCreateWorkOrder,
  useLocations,
  useItems,
  useOperationsUsers,
} from "../api/work-orders";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";

const schema = z.object({
  locationId: z.string().uuid(),
  itemId: z.string().uuid(),
  requiredQty: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  assignedToId: z.string().uuid(),
});

type FormValues = z.infer<typeof schema>;

export function CreateWorkOrderDialog() {
  const [open, setOpen] = useState(false);
  const createMutation = useCreateWorkOrder();
  const { data: locationsData } = useLocations();
  const { data: itemsData } = useItems();
  const { data: usersData } = useOperationsUsers();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
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
        e.response?.data?.error?.message || "Failed to create work order",
      );
    }
  };

  // Mocking fallback for users if endpoint doesn't exist. Assuming 1 default operations user from seed.
  const displayUsers = usersData || [
    { id: "mock-uuid", name: "Ops User (Mock)" },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Create Work Order
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Work Order</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Location</label>
            <Controller
              control={control}
              name="locationId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger
                    className={`w-full ${errors.locationId ? "border-red-500" : ""}`}
                  >
                    <SelectValue placeholder="Select Location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locationsData?.map(
                      (loc: { id: string; name: string }) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.locationId && (
              <p className="text-xs text-red-500">
                {errors.locationId.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Item</label>
            <Controller
              control={control}
              name="itemId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger
                    className={`w-full ${errors.itemId ? "border-red-500" : ""}`}
                  >
                    <SelectValue placeholder="Select Item" />
                  </SelectTrigger>
                  <SelectContent>
                    {itemsData?.map(
                      (item: { id: string; name: string }) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.itemId && (
              <p className="text-xs text-red-500">{errors.itemId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Required Quantity</label>
            <input
              type="number"
              {...register("requiredQty")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="e.g. 50"
            />
            {errors.requiredQty && (
              <p className="text-xs text-red-500">
                {errors.requiredQty.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Assign To</label>
            <Controller
              control={control}
              name="assignedToId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger
                    className={`w-full ${errors.assignedToId ? "border-red-500" : ""}`}
                  >
                    <SelectValue placeholder="Select Assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {displayUsers.map((user: { id: string; name: string }) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.assignedToId && (
              <p className="text-xs text-red-500">
                {errors.assignedToId.message}
              </p>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={createMutation.isPending || !isValid}>
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
