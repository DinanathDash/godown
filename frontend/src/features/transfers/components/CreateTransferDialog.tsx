import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateTransfer } from '../api/transfers';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import { useLocations, useItems, useBatches } from '../api/transfers';

const schema = z.object({
  itemId: z.string().uuid(),
  batchId: z.string().uuid(),
  sourceLocationId: z.string().uuid(),
  destinationLocationId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1),
}).refine((data) => data.sourceLocationId !== data.destinationLocationId, {
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
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const selectedItemId = watch('itemId');
  const availableBatches = batchesData?.filter((b: { id: string; code: string; itemId: string }) => !selectedItemId || b.itemId === selectedItemId) || [];

  const onSubmit = async (data: FormValues) => {
    try {
      await createMutation.mutateAsync(data);
      window.alert('Transfer requested');
      setOpen(false);
      reset();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      window.alert(error.response?.data?.error?.message || 'Failed to create transfer');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Request Transfer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Request Transfer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Item</label>
            <select
              {...register('itemId')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select Item</option>
              {itemsData?.map((item: { id: string; name: string; sku: string }) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.sku})
                </option>
              ))}
            </select>
            {errors.itemId && <p className="text-xs text-red-500">{errors.itemId.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Batch</label>
            <select
              {...register('batchId')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select Batch</option>
              {availableBatches.map((batch: { id: string; code: string; itemId: string }) => (
                <option key={batch.id} value={batch.id}>
                  {batch.code}
                </option>
              ))}
            </select>
            {errors.batchId && <p className="text-xs text-red-500">{errors.batchId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">From</label>
              <select
                {...register('sourceLocationId')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Source</option>
                {locationsData?.map((loc: { id: string; name: string; code: string }) => (
                  <option key={loc.id} value={loc.id}>{loc.code}</option>
                ))}
              </select>
              {errors.sourceLocationId && <p className="text-xs text-red-500">{errors.sourceLocationId.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">To</label>
              <select
                {...register('destinationLocationId')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Destination</option>
                {locationsData?.map((loc: { id: string; name: string; code: string }) => (
                  <option key={loc.id} value={loc.id}>{loc.code}</option>
                ))}
              </select>
              {errors.destinationLocationId && <p className="text-xs text-red-500">{errors.destinationLocationId.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Quantity</label>
            <Input type="number" min="1" {...register('quantity')} />
            {errors.quantity && <p className="text-xs text-red-500">{errors.quantity.message}</p>}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Requesting...' : 'Request Transfer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
