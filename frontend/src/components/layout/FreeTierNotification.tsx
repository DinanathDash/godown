"use client";

import { useEffect, useState } from "react";
import { Server, X } from "lucide-react";

export function FreeTierNotification() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const isDismissed = sessionStorage.getItem(
        "envault_hide_freetier_warning",
      );
      if (!isDismissed) setIsVisible(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem("envault_hide_freetier_warning", "true");
  };

  if (!isVisible) return null;

  return (
    <div className="group fixed hidden md:block bottom-4 right-4 z-[999] w-full max-w-[22rem] cursor-default rounded-xl border border-border bg-background/85 backdrop-blur-md p-4 shadow-lg transition-all duration-500 ease-in-out hover:shadow-xl sm:bottom-6 sm:right-6">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex-shrink-0">
          <Server className="h-4 w-4 text-muted-foreground transition-colors duration-500 group-hover:text-foreground" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Running on Free Tier Engines
              </h3>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
              </span>
            </div>
            <button
              onClick={handleDismiss}
              className="rounded-sm opacity-50 ring-offset-background transition-all duration-300 hover:scale-110 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>

          <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-500 ease-out group-hover:grid-rows-[1fr]">
            <div className="overflow-hidden">
              <div className="space-y-4 pt-3 opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100 group-hover:delay-150">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Render free tier instances spin down after inactivity. Initial
                  API requests may take up to 50 seconds to respond as the
                  instance wakes up.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
