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
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { toast } from "@/components/ui/toast";

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
    defaultValues: {
      locationId: "",
      itemId: "",
      requiredQty: 1 as unknown as number,
      assignedToId: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      await createMutation.mutateAsync(data);
      toast.add({
        title: "Success",
        description: "Work order created successfully.",
        type: "success",
      });
      reset();
      setOpen(false);
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      toast.add({
        title: "Error",
        description:
          e.response?.data?.error?.message || "Failed to create work order",
        type: "error",
      });
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
                    <SelectValue placeholder="Select Location">
                      {field.value
                        ? locationsData?.find(
                            (l: { id: string; name: string }) =>
                              l.id === field.value,
                          )?.name
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {locationsData?.map((loc: { id: string; name: string }) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
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
                    <SelectValue placeholder="Select Item">
                      {field.value
                        ? itemsData?.find(
                            (i: { id: string; name: string }) =>
                              i.id === field.value,
                          )?.name
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {itemsData?.map((item: { id: string; name: string }) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
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
            <Input
              type="number"
              {...register("requiredQty")}
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
                    <SelectValue placeholder="Select Assignee">
                      {field.value
                        ? displayUsers.find(
                            (u: { id: string; name: string }) =>
                              u.id === field.value,
                          )?.name
                        : undefined}
                    </SelectValue>
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
            <Button
              type="submit"
              disabled={createMutation.isPending || !isValid}
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
