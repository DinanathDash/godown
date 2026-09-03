"use client";

import { redirect } from "next/navigation";

export default function DashboardPage() {
  // Currently redirecting to inventory as the main dashboard is under construction
  redirect("/inventory");
}
