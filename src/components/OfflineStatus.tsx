"use client";

import { useEffect, useRef, useState } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";

export function OfflineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const hasMounted = useRef(false);

  useEffect(() => {
    const updateOnlineStatus = () => {
      const nextIsOnline = navigator.onLine;
      setIsOnline(nextIsOnline);

      if (!hasMounted.current) {
        hasMounted.current = true;
        return;
      }

      if (nextIsOnline) {
        toast.success("You are back online.");
      } else {
        toast.error("You are offline. Please reconnect and try again.");
      }
    };

    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm"
    >
      <WifiOff className="h-4 w-4" />
      You are offline. Check your connection. Changes cannot be saved until you
      are back online.
    </div>
  );
}
