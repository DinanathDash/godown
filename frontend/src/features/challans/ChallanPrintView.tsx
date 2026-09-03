import React from "react";
import { format } from "date-fns";
import { Command } from "lucide-react";
import { Challan } from "@/types/api";

interface ChallanPrintViewProps {
  challan: Challan;
}

export function ChallanPrintView({ challan }: ChallanPrintViewProps) {
  const isDraft = challan.status === "DRAFT";

  return (
    <div
      id="challan-print-document"
      className="fixed top-0 left-0 -z-50 pointer-events-none bg-white text-slate-900 font-mono p-10 w-[800px]"
      style={{ letterSpacing: "0.02em" }}
    >
      <div className="border border-dashed border-slate-300 p-8 flex flex-col gap-8">
        {/* Header */}
        <div className="text-center font-bold text-blue-600">
          [ {isDraft ? "Draft " : ""}Challan - ₹
          {parseFloat(challan.totalAmount).toFixed(2)} ]
        </div>

        {/* Company & Meta */}
        <div className="flex justify-between items-start text-sm">
          <div>
            <div className="font-bold text-lg mb-2 flex items-center">
              <Command className="w-5 h-5 mr-2" /> Counterfoil
            </div>
          </div>
          <div className="text-right">
            <div className="flex justify-between w-56 mb-1">
              <span className="text-slate-500 text-left">Ref</span>
              <span>{challan.challanNumber || "DRAFT"}</span>
            </div>
            <div className="flex justify-between w-56 mb-1">
              <span className="text-slate-500 text-left">Issued</span>
              <span>
                {challan.confirmedAt
                  ? format(new Date(challan.confirmedAt), "dd MMM yyyy")
                  : format(new Date(challan.createdAt), "dd MMM yyyy")}
              </span>
            </div>
            <div className="flex justify-between w-56">
              <span className="text-slate-500 text-left">Status</span>
              <span
                className={
                  challan.status === "DRAFT"
                    ? "text-blue-600 font-bold"
                    : challan.status === "CONFIRMED"
                      ? "text-emerald-600 font-bold"
                      : "text-red-600 font-bold"
                }
              >
                {challan.status}
              </span>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-dashed border-slate-300" />

        {/* From & Bill To */}
        <div className="flex gap-8 text-sm">
          <div className="flex-1">
            <div className="text-slate-500 mb-2">[ From ]</div>
            <div className="font-bold mb-1">Counterfoil ERP</div>
            <div>123 Tech Park</div>
            <div>Bangalore, KA 560001</div>
            <div>India</div>
            <div className="mt-1">GST: 29ABCDE1234F1Z5</div>
          </div>
          <div className="flex-1">
            <div className="text-slate-500 mb-2">[ Bill to ]</div>
            <div className="font-bold mb-1">
              {challan.customerSnapshot?.name || "Unknown"}
            </div>
            {challan.customerSnapshot?.businessName && (
              <div>{challan.customerSnapshot.businessName}</div>
            )}
            {challan.customerSnapshot?.address && (
              <div className="whitespace-pre-wrap">
                {challan.customerSnapshot.address}
              </div>
            )}
            {(challan.customerSnapshot?.mobile ||
              challan.customerSnapshot?.email) && (
              <div className="mt-1">
                {[
                  challan.customerSnapshot.mobile,
                  challan.customerSnapshot.email,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </div>
            )}
            {challan.customerSnapshot?.gstNumber && (
              <div className="mt-1">
                GST: {challan.customerSnapshot.gstNumber}
              </div>
            )}
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-dashed border-slate-300" />

        {/* Table */}
        <div className="text-sm">
          <div className="flex mb-4 text-slate-500">
            <div className="flex-1">Description</div>
            <div className="w-16 text-right">Qty</div>
            <div className="w-24 text-right">Unit price</div>
            <div className="w-24 text-right">Amount</div>
          </div>
          <div className="border-t border-dashed border-slate-300 mb-4" />

          <div className="flex flex-col gap-4">
            {challan.items?.map((item) => (
              <div key={item.id} className="flex">
                <div className="flex-1 pr-4">
                  <div className="font-bold">{item.productName}</div>
                  <div className="text-slate-500">SKU: {item.sku}</div>
                </div>
                <div className="w-16 text-right">{item.quantity}</div>
                <div className="w-24 text-right">
                  ₹{parseFloat(item.unitPrice).toFixed(2)}
                </div>
                <div className="w-24 text-right">
                  ₹{parseFloat(item.lineTotal).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-slate-300 mt-4 mb-4" />

          {/* Totals */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex justify-between w-64">
              <span className="text-slate-500">Subtotal</span>
              <span>₹{parseFloat(challan.totalAmount).toFixed(2)}</span>
            </div>
            <div className="border-t border-dashed border-slate-300 w-64 my-1" />
            <div className="flex justify-between w-64 font-bold">
              <span>Total due</span>
              <span>₹{parseFloat(challan.totalAmount).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {challan.notes && (
          <>
            <div className="border-t border-dashed border-slate-300" />
            <div className="text-sm">
              <div className="text-slate-500 mb-2">[ Notes ]</div>
              <div className="whitespace-pre-wrap">{challan.notes}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
