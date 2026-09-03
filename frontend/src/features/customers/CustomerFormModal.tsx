"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { customersApi } from "@/api/customers";
import { Customer } from "@/types/api";
import { toast } from "@/components/ui/toast";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const customerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  businessName: z.string().max(100).optional().nullable(),
  email: z
    .string()
    .email("Invalid email")
    .optional()
    .nullable()
    .or(z.literal("")),
  mobile: z.string().regex(/^\d{10,15}$/, "Must be 10-15 digits"),
  address: z.string().max(500).optional().nullable(),
  type: z.enum(["RETAIL", "WHOLESALE", "DISTRIBUTOR"]),
  status: z.enum(["LEAD", "ACTIVE", "INACTIVE"]),
  creditLimit: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Must be a valid decimal")
    .optional(),
  gstin: z.string().max(15).optional().nullable(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: Customer;
}

export function CustomerFormModal({
  isOpen,
  onClose,
  customer,
}: CustomerFormModalProps) {
  const isEditing = !!customer;
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      type: "RETAIL",
      status: "LEAD",
      creditLimit: "0.00",
    },
  });

  useEffect(() => {
    if (customer && isOpen) {
      reset({
        name: customer.name,
        businessName: customer.businessName,
        email: customer.email,
        mobile: customer.mobile,
        address: customer.address,
        type: customer.type,
        status: customer.status,
        creditLimit: customer.creditLimit,
        gstin: customer.gstin,
      });
    } else if (isOpen) {
      reset({
        name: "",
        businessName: "",
        email: "",
        mobile: "",
        address: "",
        type: "RETAIL",
        status: "LEAD",
        creditLimit: "0.00",
        gstin: "",
      });
    }
  }, [customer, isOpen, reset]);

  const mutation = useMutation({
    mutationFn: (data: CustomerFormValues) => {
      // Clean up empty strings to null for optional fields
      const cleanedData = {
        ...data,
        email: data.email || null,
        businessName: data.businessName || null,
        address: data.address || null,
        gstin: data.gstin || null,
      };

      if (isEditing && customer) {
        return customersApi.updateCustomer(customer.id, cleanedData);
      }
      return customersApi.createCustomer(cleanedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.add({
        title: isEditing ? "Customer updated" : "Customer created",
        description: isEditing
          ? "The customer has been updated successfully."
          : "The new customer has been added.",
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

  const onSubmit = (data: CustomerFormValues) => {
    mutation.mutate(data);
  };

  // eslint-disable-next-line react-hooks/incompatible-library
  const typeValue = watch("type");
  const statusValue = watch("status");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-surface border-line max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-ink">
            {isEditing ? "Edit Customer" : "Add Customer"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="Contact person name"
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
                {...register("businessName")}
                placeholder="Company name"
              />
              {errors.businessName && (
                <p className="text-xs text-destructive">
                  {errors.businessName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobile">
                Mobile <span className="text-destructive">*</span>
              </Label>
              <Input
                id="mobile"
                {...register("mobile")}
                placeholder="10-digit number"
              />
              {errors.mobile && (
                <p className="text-xs text-destructive">
                  {errors.mobile.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="email@example.com"
              />
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={typeValue}
                onValueChange={(val) =>
                  setValue(
                    "type",
                    val as "RETAIL" | "WHOLESALE" | "DISTRIBUTOR",
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RETAIL">Retail</SelectItem>
                  <SelectItem value="WHOLESALE">Wholesale</SelectItem>
                  <SelectItem value="DISTRIBUTOR">Distributor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={statusValue}
                onValueChange={(val) =>
                  setValue("status", val as "LEAD" | "ACTIVE" | "INACTIVE")
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LEAD">Lead</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="creditLimit">Credit Limit (₹)</Label>
              <Input
                id="creditLimit"
                {...register("creditLimit")}
                placeholder="0.00"
              />
              {errors.creditLimit && (
                <p className="text-xs text-destructive">
                  {errors.creditLimit.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="gstin">GSTIN</Label>
              <Input
                id="gstin"
                {...register("gstin")}
                placeholder="15-digit GST number"
              />
              {errors.gstin && (
                <p className="text-xs text-destructive">
                  {errors.gstin.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              {...register("address")}
              placeholder="Full address"
            />
            {errors.address && (
              <p className="text-xs text-destructive">
                {errors.address.message}
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {mutation.isPending ? "Saving..." : "Save Customer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
