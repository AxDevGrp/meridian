"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error("Application error:", error);
    }, [error]);

    return (
        <div className="w-full h-full absolute inset-0 flex items-center justify-center bg-background">
            <div className="space-y-4 text-center max-w-md p-6">
                <div className="flex justify-center">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                </div>
                <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
                <p className="text-muted-foreground text-sm">
                    {error.message || "An unexpected error occurred while loading the application."}
                </p>
                {error.digest && (
                    <p className="text-xs text-muted-foreground/60">
                        Error ID: {error.digest}
                    </p>
                )}
                <Button onClick={reset} variant="outline" className="mt-4">
                    Try again
                </Button>
            </div>
        </div>
    );
}
