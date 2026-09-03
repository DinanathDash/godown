"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { customersApi } from "@/api/customers";
import { toast } from "@/components/ui/toast";

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const noteSchema = z.object({
  note: z.string().min(1, "Note text is required").max(1000),
  followUpDate: z.string().optional().or(z.literal("")),
  status: z.enum(["LEAD", "ACTIVE", "INACTIVE"]).optional(),
});

type NoteFormValues = z.infer<typeof noteSchema>;

interface FollowUpNoteFormProps {
  customerId: string;
  currentStatus: string;
}

export function FollowUpNoteForm({
  customerId,
  currentStatus,
}: FollowUpNoteFormProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<NoteFormValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      status: currentStatus as "LEAD" | "ACTIVE" | "INACTIVE",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: NoteFormValues) => {
      let isoDate = undefined;
      if (data.followUpDate) {
        isoDate = new Date(data.followUpDate).toISOString();
      } else if (data.followUpDate === "") {
        isoDate = null; // Backend accepts null to clear
      }

      return customersApi.addCustomerNote(customerId, {
        note: data.note,
        followUpDate: isoDate,
        status: data.status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      queryClient.invalidateQueries({
        queryKey: ["customer-notes", customerId],
      });
      toast.add({
        title: "Note added",
        description: "Your follow-up note has been added.",
      });
      reset({ note: "", followUpDate: "" });
      setValue("status", currentStatus as "LEAD" | "ACTIVE" | "INACTIVE");
    },
    onError: (err: unknown) => {
      const error = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      toast.add({
        title: "Error",
        description:
          error.response?.data?.error?.message || "Failed to add note.",
        type: "error",
      });
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const statusValue = watch("status");

  const onSubmit = (data: NoteFormValues) => {
    mutation.mutate(data);
  };

  return (
    <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm">
      <h3 className="font-semibold text-ink mb-3">Add Follow-up Note</h3>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Textarea
            {...register("note")}
            placeholder="Type your note here..."
            className="w-full min-h-[100px] p-3 text-sm rounded-md border border-input bg-transparent shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {errors.note && (
            <p className="text-xs text-destructive">{errors.note.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Next Follow-up Date (Optional)</Label>
            <Controller
              control={control}
              name="followUpDate"
              render={({ field }) => (
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal h-9 px-3",
                          !field.value && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                        {field.value ? (
                          format(new Date(field.value), "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    }
                  />
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ? new Date(field.value) : undefined}
                      onSelect={(date) =>
                        field.onChange(date ? format(date, "yyyy-MM-dd") : "")
                      }
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>Update Status (Optional)</Label>
            <Select
              value={statusValue}
              onValueChange={(val) =>
                setValue("status", val as "LEAD" | "ACTIVE" | "INACTIVE")
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LEAD">Lead</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={mutation.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            {mutation.isPending ? "Saving..." : "Save Note"}
          </Button>
        </div>
      </form>
    </div>
  );
}
