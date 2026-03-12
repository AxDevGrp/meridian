import type {
    IntelReport,
    ReportGenerationRequest,
    ThreatLevel,
    ReportClassification,
} from "@/lib/types/intel-report";

/**
 * Intel Reports service — fetch wrappers for report API routes.
 * Follows the same pattern as lib/services/market.ts.
 */

// === API base paths ===

const API_REPORTS = "/api/intel/reports";
const API_GENERATE = "/api/intel/reports/generate";

// === Summary type (subset of IntelReport for list views) ===

export interface IntelReportSummary {
    id: string;
    title: string;
    regionName: string;
    threatLevel: ThreatLevel;
    classification: ReportClassification;
    generatedAt: string;
    isSampleData: boolean;
}

// === API response types ===

interface ReportListResponse {
    success: boolean;
    data: Array<{
        id: string;
        title: string;
        regionName: string;
        regionCenter: { lat: number; lng: number };
        regionRadiusKm: number;
        threatLevel: ThreatLevel;
        classification: ReportClassification;
        executiveSummary: string;
        keyFindings: string[];
        generatedAt: string;
        expiresAt: string;
        metadata: {
            isSampleData: boolean;
            totalEntitiesAnalyzed: number;
            processingTimeMs: number;
        };
    }>;
    count: number;
    timestamp: string;
}

interface ReportDetailResponse {
    success: boolean;
    data: IntelReport;
    timestamp: string;
}

interface ReportGenerateResponse {
    success: boolean;
    data: IntelReport;
    timestamp: string;
}

// === Fetch functions ===

/**
 * Fetch the list of all generated reports (summary projections).
 */
export async function fetchReportList(): Promise<IntelReportSummary[]> {
    const response = await fetch(API_REPORTS);

    if (!response.ok) {
        throw new Error(`Failed to fetch report list: ${response.status}`);
    }

    const data: ReportListResponse = await response.json();

    return data.data.map((r) => ({
        id: r.id,
        title: r.title,
        regionName: r.regionName,
        threatLevel: r.threatLevel,
        classification: r.classification,
        generatedAt: r.generatedAt,
        isSampleData: r.metadata.isSampleData,
    }));
}

/**
 * Fetch a full report by ID.
 */
export async function fetchReport(id: string): Promise<IntelReport> {
    const response = await fetch(`${API_REPORTS}/${id}`);

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`Report not found: ${id}`);
        }
        throw new Error(`Failed to fetch report: ${response.status}`);
    }

    const data: ReportDetailResponse = await response.json();
    return data.data;
}

/**
 * Generate a new intel report for a region.
 */
export async function generateReport(request: ReportGenerationRequest): Promise<IntelReport> {
    const response = await fetch(API_GENERATE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
            errorData?.error ?? `Failed to generate report: ${response.status}`,
        );
    }

    const data: ReportGenerateResponse = await response.json();
    return data.data;
}

/**
 * Export a report in the specified format.
 * Currently only "markdown" is supported.
 */
export async function exportReport(id: string, format: "markdown"): Promise<string> {
    const response = await fetch(`${API_REPORTS}/${id}/export?format=${format}`);

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`Report not found: ${id}`);
        }
        throw new Error(`Failed to export report: ${response.status}`);
    }

    return response.text();
}
