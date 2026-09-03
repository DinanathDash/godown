"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productsApi } from "@/api/products";
import { Product } from "@/types/api";
import { useAuthStore } from "@/store/useAuthStore";
import { useDebounce } from "@/hooks/useDebounce";
import { ProductFormModal } from "@/features/products/ProductFormModal";
import { StockAdjustModal } from "@/features/products/StockAdjustModal";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "@/components/ui/toast";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Plus, AlertCircle, Search } from "lucide-react";

export default function ProductListPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const canCreate = user?.role === "ADMIN" || user?.role === "WAREHOUSE";
  const canDelete = user?.role === "ADMIN";

  const [page, setPage] = useState(1);
  const limit = 10;

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);

  const searchParams = useSearchParams();
  const [lowStockOnly, setLowStockOnly] = useState(
    searchParams.get("lowStock") === "true",
  );

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [
      "products",
      { page, limit, q: debouncedSearch, lowStock: lowStockOnly },
    ],
    queryFn: () =>
      productsApi.getProducts({
        page,
        limit,
        q: debouncedSearch,
        lowStock: lowStockOnly ? true : undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: productsApi.deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.add({
        title: "Product deleted",
        description: "The product was successfully deleted.",
      });
    },
    onError: (err: unknown) => {
      const error = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      toast.add({
        title: "Error",
        description:
          error.response?.data?.error?.message || "Failed to delete product.",
        type: "error",
      });
    },
  });

  const confirmDelete = () => {
    if (productToDelete) {
      deleteMutation.mutate(productToDelete);
      setProductToDelete(null);
    }
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setIsFormOpen(true);
  };

  const handleAdjustStock = (product: Product) => {
    setSelectedProduct(product);
    setIsAdjustOpen(true);
  };

  const openCreateModal = () => {
    setSelectedProduct(null);
    setIsFormOpen(true);
  };

  return (
    <div className="pb-8 tracking-[0.01em] space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Products & Inventory
          </h1>
          <p className="text-muted-foreground text-[13px] leading-tight">
            Manage your product catalog and stock levels.
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={openCreateModal}
            className="rounded-[10px] h-9 shadow-sm"
          >
            <Plus className="mr-2 h-4 w-4" /> Add product
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 shadow-sm border-[0.5px] border-border/50 rounded-2xl">
        <div className="w-full sm:w-1/3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products by Name or SKU..."
            value={searchTerm}
            className="h-9 rounded-[10px] shadow-sm border-[0.5px] border-border/50 pl-9"
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="low-stock"
            checked={lowStockOnly}
            onCheckedChange={(checked) => {
              setLowStockOnly(checked);
              setPage(1);
            }}
          />
          <Label
            htmlFor="low-stock"
            className="flex items-center cursor-pointer text-[13px] leading-tight"
          >
            <AlertCircle className="w-4 h-4 mr-2 text-destructive" />
            Low stock only
          </Label>
        </div>
      </div>

      <div className="bg-card shadow-sm border-[0.5px] border-border/50 rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-canvas/50 border-b-[0.5px] border-border/50 hover:bg-canvas/50">
              <TableHead className="w-[100px] text-[12px] font-medium text-muted-foreground tracking-wider pl-5">
                SKU
              </TableHead>
              <TableHead className="text-[12px] font-medium text-muted-foreground tracking-wider">
                Product Info
              </TableHead>
              <TableHead className="text-[12px] font-medium text-muted-foreground tracking-wider">
                Price
              </TableHead>
              <TableHead className="text-[12px] font-medium text-muted-foreground tracking-wider">
                Stock
              </TableHead>
              <TableHead className="text-[12px] font-medium text-muted-foreground tracking-wider">
                Location
              </TableHead>
              <TableHead className="text-right text-[12px] font-medium text-muted-foreground tracking-wider pr-5">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-b-[0.5px] border-border/50">
                  <TableCell className="pl-5">
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell className="pr-5">
                    <Skeleton className="h-8 w-8 ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : data?.data.length === 0 ? (
              <TableRow className="border-b-[0.5px] border-border/50">
                <TableCell
                  colSpan={6}
                  className="text-center py-10 text-muted-foreground text-[13px] leading-tight"
                >
                  No products found.
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((product) => (
                <TableRow
                  key={product.id}
                  className="hover:bg-canvas/50 transition-colors border-b-[0.5px] border-border/50"
                >
                  <TableCell className="font-mono text-[13px] leading-tight pl-5">
                    {product.sku}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-ink text-[13px] leading-tight">
                      {product.name}
                    </div>
                    <div className="text-xs text-muted-foreground leading-tight mt-0.5">
                      {product.category}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-[13px] leading-tight">
                    ₹{parseFloat(product.unitPrice).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`font-semibold text-[13px] leading-tight ${product.currentStock <= product.minStockAlert ? "text-destructive" : "text-ink"}`}
                      >
                        {product.currentStock}
                      </span>
                      {product.currentStock <= product.minStockAlert && (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-destructive border-[0.5px] border-destructive px-1 py-0 h-4 rounded-[6px]"
                        >
                          Low
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-[13px] leading-tight">
                    {product.location || "-"}
                  </TableCell>
                  <TableCell className="text-right pr-5">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0 rounded-[8px]"
                          />
                        }
                      >
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="rounded-[10px] shadow-sm border-[0.5px] border-border/50"
                      >
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="text-[12px] text-muted-foreground">
                            Actions
                          </DropdownMenuLabel>
                          <DropdownMenuItem
                            render={
                              <Link
                                href={`/products/${product.id}`}
                                className="cursor-pointer text-[13px]"
                              />
                            }
                          >
                            View details & history
                          </DropdownMenuItem>
                          {canCreate && (
                            <>
                              <DropdownMenuSeparator className="border-border/50 border-b-[0.5px]" />
                              <DropdownMenuItem
                                onClick={() => handleEdit(product)}
                                className="cursor-pointer text-[13px]"
                              >
                                Edit product
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleAdjustStock(product)}
                                className="cursor-pointer text-[13px]"
                              >
                                Adjust stock
                              </DropdownMenuItem>
                            </>
                          )}
                          {canDelete && (
                            <>
                              <DropdownMenuSeparator className="border-border/50 border-b-[0.5px]" />
                              <DropdownMenuItem
                                onClick={() => setProductToDelete(product.id)}
                                className="text-destructive focus:text-destructive cursor-pointer text-[13px]"
                              >
                                Delete product
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data?.meta && data.meta.totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-[10px] shadow-sm border-[0.5px] border-border/50"
              >
                Previous
              </Button>
            </PaginationItem>
            <PaginationItem>
              <span className="text-[13px] leading-tight text-muted-foreground mx-4">
                Page {page} of {data.meta.totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setPage((p) => Math.min(data.meta.totalPages, p + 1))
                }
                disabled={page === data.meta.totalPages}
                className="rounded-[10px] shadow-sm border-[0.5px] border-border/50"
              >
                Next
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <ProductFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        product={selectedProduct}
      />

      <StockAdjustModal
        isOpen={isAdjustOpen}
        onClose={() => setIsAdjustOpen(false)}
        product={selectedProduct}
      />

      <AlertDialog
        open={!!productToDelete}
        onOpenChange={(open) => !open && setProductToDelete(null)}
      >
        <AlertDialogContent className="rounded-[12px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this
              product from your inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[10px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="rounded-[10px] bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
