/**
 * Server-side in-memory report store (MVP).
 * Used by API routes to persist generated reports during the server process lifetime.
 *
 * In production this would be replaced by database persistence.
 */

import type { IntelReport } from "@/lib/types/intel-report";

/** Module-level store — persists for the lifetime of the Node process */
const reportStore = new Map<string, IntelReport>();

export function getReport(id: string): IntelReport | undefined {
    return reportStore.get(id);
}

export function getAllReports(): IntelReport[] {
    return Array.from(reportStore.values()).sort(
        (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime(),
    );
}

export function storeReport(report: IntelReport): void {
    reportStore.set(report.id, report);
}

export function reportCount(): number {
    return reportStore.size;
}
