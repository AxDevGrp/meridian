"use client";

import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { IntelReport, ReportGenerationRequest } from "@/lib/types/intel-report";
import type { IntelReportSummary } from "@/lib/services/intel-reports";
import {
    fetchReportList,
    fetchReport as fetchReportAPI,
    generateReport as generateReportAPI,
    exportReport as exportReportAPI,
} from "@/lib/services/intel-reports";

/**
 * Zustand store for managing intel reports on the client side.
 * Handles report listing, detail fetching, generation, and export.
 */

// === State interface ===

interface IntelStoreState {
    // Report list
    reports: IntelReportSummary[];
    reportsLoading: boolean;
    reportsError: string | null;

    // Active report (full detail)
    activeReport: IntelReport | null;
    activeReportLoading: boolean;
    activeReportError: string | null;

    // Report generation
    isGenerating: boolean;
    generationError: string | null;

    // Report panel visibility
    reportPanelOpen: boolean;
    reportViewerOpen: boolean;

    // Actions
    fetchReports: () => Promise<void>;
    fetchReport: (id: string) => Promise<void>;
    generateReport: (request: ReportGenerationRequest) => Promise<IntelReport | null>;
    exportReport: (id: string, format: "markdown") => Promise<string | null>;

    setReportPanelOpen: (open: boolean) => void;
    setReportViewerOpen: (open: boolean) => void;
    clearActiveReport: () => void;
}

// === Initial state ===

const initialState = {
    reports: [] as IntelReportSummary[],
    reportsLoading: false,
    reportsError: null as string | null,

    activeReport: null as IntelReport | null,
    activeReportLoading: false,
    activeReportError: null as string | null,

    isGenerating: false,
    generationError: null as string | null,

    reportPanelOpen: false,
    reportViewerOpen: false,
};

// === Store ===

export const useIntelStore = create<IntelStoreState>((set, get) => ({
    ...initialState,

    // ─── Fetch Report List ──────────────────────────────────

    fetchReports: async () => {
        set({ reportsLoading: true, reportsError: null });

        try {
            const reports = await fetchReportList();
            set({
                reports,
                reportsLoading: false,
            });
        } catch (err) {
            set({
                reportsLoading: false,
                reportsError:
                    err instanceof Error ? err.message : "Failed to fetch reports",
            });
        }
    },

    // ─── Fetch Single Report ────────────────────────────────

    fetchReport: async (id: string) => {
        set({ activeReportLoading: true, activeReportError: null });

        try {
            const report = await fetchReportAPI(id);
            set({
                activeReport: report,
                activeReportLoading: false,
                reportViewerOpen: true,
            });
        } catch (err) {
            set({
                activeReportLoading: false,
                activeReportError:
                    err instanceof Error ? err.message : "Failed to fetch report",
            });
        }
    },

    // ─── Generate Report ────────────────────────────────────

    generateReport: async (request: ReportGenerationRequest) => {
        set({ isGenerating: true, generationError: null });

        try {
            const report = await generateReportAPI(request);

            // Add to report list as a summary
            const summary: IntelReportSummary = {
                id: report.id,
                title: report.title,
                regionName: report.regionName,
                threatLevel: report.threatLevel,
                classification: report.classification,
                generatedAt: report.generatedAt,
                isSampleData: report.metadata.isSampleData,
            };

            set((state) => ({
                isGenerating: false,
                activeReport: report,
                reportViewerOpen: true,
                reports: [summary, ...state.reports],
            }));

            return report;
        } catch (err) {
            set({
                isGenerating: false,
                generationError:
                    err instanceof Error ? err.message : "Failed to generate report",
            });
            return null;
        }
    },

    // ─── Export Report ──────────────────────────────────────

    exportReport: async (id: string, format: "markdown") => {
        try {
            return await exportReportAPI(id, format);
        } catch (err) {
            console.error("Export failed:", err);
            return null;
        }
    },

    // ─── Panel Visibility ───────────────────────────────────

    setReportPanelOpen: (open: boolean) => {
        set({ reportPanelOpen: open });
    },

    setReportViewerOpen: (open: boolean) => {
        set({ reportViewerOpen: open });
        if (!open) {
            set({ activeReport: null, activeReportError: null });
        }
    },

    clearActiveReport: () => {
        set({
            activeReport: null,
            activeReportLoading: false,
            activeReportError: null,
            reportViewerOpen: false,
        });
    },
}));

// === Selector Hooks ===

/** Report list with loading/error state */
export const useReportList = () =>
    useIntelStore(
        useShallow((s) => ({
            reports: s.reports,
            loading: s.reportsLoading,
            error: s.reportsError,
        })),
    );

/** Active report detail with loading/error state */
export const useActiveReport = () =>
    useIntelStore(
        useShallow((s) => ({
            report: s.activeReport,
            loading: s.activeReportLoading,
            error: s.activeReportError,
        })),
    );

/** Report generation state */
export const useReportGeneration = () =>
    useIntelStore(
        useShallow((s) => ({
            isGenerating: s.isGenerating,
            error: s.generationError,
        })),
    );

/** Panel visibility state */
export const useReportPanelState = () =>
    useIntelStore(
        useShallow((s) => ({
            panelOpen: s.reportPanelOpen,
            viewerOpen: s.reportViewerOpen,
        })),
    );
