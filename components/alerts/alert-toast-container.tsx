"use client";

import { AlertToast } from "./alert-toast";
import { useAlertToasts } from "@/lib/stores/alert-store";

/**
 * Container that renders all active toast notifications.
 * Fixed position top-right, below header, z-50.
 * Max 3 toasts shown at once (enforced by store).
 */
export function AlertToastContainer() {
    const { toasts } = useAlertToasts();

    if (toasts.length === 0) return null;

    return (
        <div className="pointer-events-none fixed right-4 top-16 z-50 flex flex-col gap-2">
            {toasts.map((toast) => (
                <AlertToast key={toast.id} notification={toast} />
            ))}
        </div>
    );
}
