import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateTransfer } from "../api/transfers";
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
import { useLocations, useItems, useBatches } from "../api/transfers";

const schema = z
  .object({
    itemId: z.string().uuid(),
    batchId: z.string().uuid(),
    sourceLocationId: z.string().uuid(),
    destinationLocationId: z.string().uuid(),
    quantity: z.coerce.number().int().min(1),
  })
  .refine((data) => data.sourceLocationId !== data.destinationLocationId, {
    message: "Source and destination cannot be the same",
    path: ["destinationLocationId"],
  });

type FormValues = z.infer<typeof schema>;

export function CreateTransferDialog() {
  const [open, setOpen] = useState(false);
  const createMutation = useCreateTransfer();
  const { data: locationsData } = useLocations();
  const { data: itemsData } = useItems();
  const { data: batchesData } = useBatches();

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      itemId: "",
      batchId: "",
      sourceLocationId: "",
      destinationLocationId: "",
      quantity: 1 as unknown as number,
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const selectedItemId = watch("itemId");
  const availableBatches =
    batchesData?.filter(
      (b: { id: string; code: string; itemId: string }) =>
        !selectedItemId || b.itemId === selectedItemId,
    ) || [];

  const onSubmit = async (data: FormValues) => {
    try {
      await createMutation.mutateAsync(data);
      toast.add({
        title: "Success",
        description: "Transfer requested successfully.",
        type: "success",
      });
      setOpen(false);
      reset();
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      toast.add({
        title: "Error",
        description:
          error.response?.data?.error?.message || "Failed to create transfer",
        type: "error",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Request Transfer
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Request Transfer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
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
            <label className="text-sm font-medium">Batch</label>
            <Controller
              control={control}
              name="batchId"
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={!selectedItemId}
                >
                  <SelectTrigger
                    className={`w-full ${errors.batchId ? "border-red-500" : ""}`}
                  >
                    <SelectValue placeholder="Select Batch">
                      {field.value
                        ? availableBatches.find(
                            (b: { id: string; code: string; itemId: string }) =>
                              b.id === field.value,
                          )?.code
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableBatches.map(
                      (batch: { id: string; code: string; itemId: string }) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.code}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.batchId && (
              <p className="text-xs text-red-500">{errors.batchId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">From</label>
              <Controller
                control={control}
                name="sourceLocationId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger
                      className={`w-full ${errors.sourceLocationId ? "border-red-500" : ""}`}
                    >
                      <SelectValue placeholder="Source">
                        {field.value
                          ? locationsData?.find(
                              (l: { id: string; name: string }) =>
                                l.id === field.value,
                            )?.name
                          : undefined}
                      </SelectValue>
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
              {errors.sourceLocationId && (
                <p className="text-xs text-red-500">
                  {errors.sourceLocationId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">To</label>
              <Controller
                control={control}
                name="destinationLocationId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger
                      className={`w-full ${errors.destinationLocationId ? "border-red-500" : ""}`}
                    >
                      <SelectValue placeholder="Destination">
                        {field.value
                          ? locationsData?.find(
                              (l: { id: string; name: string }) =>
                                l.id === field.value,
                            )?.name
                          : undefined}
                      </SelectValue>
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
              {errors.destinationLocationId && (
                <p className="text-xs text-red-500">
                  {errors.destinationLocationId.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Quantity</label>
            <Input type="number" min="1" {...register("quantity")} />
            {errors.quantity && (
              <p className="text-xs text-red-500">{errors.quantity.message}</p>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || !isValid}
            >
              {createMutation.isPending ? "Requesting..." : "Request Transfer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
