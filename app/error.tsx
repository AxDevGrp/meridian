"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error("Application error:", error);
    }, [error]);

    return (
        <html lang="en" className="dark">
            <body className="bg-background text-foreground antialiased">
                <div className="w-full h-screen flex items-center justify-center">
                    <div className="space-y-4 text-center max-w-md p-6">
                        <div className="flex justify-center">
                            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                                <AlertTriangle className="w-8 h-8 text-red-500" />
                            </div>
                        </div>
                        <h2 className="text-xl font-semibold">Something went wrong</h2>
                        <p className="text-muted-foreground text-sm">
                            {error.message || "An unexpected error occurred while loading the application."}
                        </p>
                        {error.digest && (
                            <p className="text-xs text-muted-foreground/60">
                                Error ID: {error.digest}
                            </p>
                        )}
                        <div className="flex gap-2 justify-center mt-4">
                            <Button onClick={reset} variant="default">
                                Try again
                            </Button>
                            <Button onClick={() => window.location.href = "/"} variant="outline">
                                Go home
                            </Button>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    );
}
