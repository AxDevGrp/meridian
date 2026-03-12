/**
 * Pure TypeScript statistical computation library.
 * No external dependencies. All functions are pure (no side effects).
 * Empty arrays return 0 / neutral values for all computations.
 */

import type {
    TimeSeriesPoint,
    MovingAverageResult,
    ZScoreResult,
    TrendResult,
    KernelDensityResult,
    RiskTrend,
} from "@/lib/types/analytics";
import { haversineKm } from "@/lib/correlation-engine";

// ============================================
// Basic Statistics
// ============================================

/** Arithmetic mean of a numeric array. Returns 0 for empty input. */
export function mean(values: number[]): number {
    if (values.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
        sum += values[i];
    }
    return sum / values.length;
}

/** Population variance of a numeric array. Returns 0 for empty input. */
export function variance(values: number[]): number {
    if (values.length === 0) return 0;
    const m = mean(values);
    let sumSq = 0;
    for (let i = 0; i < values.length; i++) {
        const diff = values[i] - m;
        sumSq += diff * diff;
    }
    return sumSq / values.length;
}

/** Population standard deviation. Returns 0 for empty input. */
export function standardDeviation(values: number[]): number {
    return Math.sqrt(variance(values));
}

/** Median of a numeric array. Returns 0 for empty input. */
export function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
}

/**
 * Compute the p-th percentile using linear interpolation.
 * @param p Percentile value between 0 and 100.
 * Returns 0 for empty input.
 */
export function percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const clampedP = Math.max(0, Math.min(100, p));
    const rank = (clampedP / 100) * (sorted.length - 1);
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    if (lower === upper) return sorted[lower];
    const fraction = rank - lower;
    return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
}

// ============================================
// Moving Averages
// ============================================

/**
 * Simple Moving Average.
 * Returns an array of averaged values with length = values.length - period + 1.
 * Returns empty result for insufficient data.
 */
export function sma(values: number[], period: number): MovingAverageResult {
    if (values.length < period || period <= 0) {
        return { values: [], period };
    }

    const result: number[] = [];
    let windowSum = 0;

    // Seed the first window
    for (let i = 0; i < period; i++) {
        windowSum += values[i];
    }
    result.push(windowSum / period);

    // Slide the window
    for (let i = period; i < values.length; i++) {
        windowSum += values[i] - values[i - period];
        result.push(windowSum / period);
    }

    return { values: result, period };
}

/**
 * Exponential Moving Average.
 * Multiplier = 2 / (period + 1). Seeded with the first value.
 * Returns empty result for insufficient data.
 */
export function ema(values: number[], period: number): MovingAverageResult {
    if (values.length === 0 || period <= 0) {
        return { values: [], period };
    }

    const multiplier = 2 / (period + 1);
    const result: number[] = [values[0]]; // seed with first value

    for (let i = 1; i < values.length; i++) {
        const prev = result[i - 1];
        result.push((values[i] - prev) * multiplier + prev);
    }

    return { values: result, period };
}

// ============================================
// Anomaly Detection
// ============================================

/**
 * Compute the z-score of a value relative to a dataset.
 * Uses a default anomaly threshold of 2.0.
 */
export function zScore(value: number, values: number[]): ZScoreResult {
    return zScoreWithThreshold(value, values, 2.0);
}

/**
 * Compute the z-score with a configurable anomaly threshold.
 * @param threshold Defaults to 2.0 if not provided.
 */
export function zScoreWithThreshold(
    value: number,
    values: number[],
    threshold: number = 2.0,
): ZScoreResult {
    const m = mean(values);
    const sd = standardDeviation(values);

    if (sd === 0) {
        return {
            zScore: 0,
            mean: m,
            stdDev: 0,
            isAnomaly: false,
            threshold,
        };
    }

    const z = (value - m) / sd;

    return {
        zScore: z,
        mean: m,
        stdDev: sd,
        isAnomaly: Math.abs(z) > threshold,
        threshold,
    };
}

// ============================================
// Trend Analysis
// ============================================

/**
 * Least-squares linear regression on time-series data.
 * Returns slope, R², direction, and a prediction for the next point.
 * Returns neutral result for fewer than 2 data points.
 */
export function linearRegression(points: TimeSeriesPoint[]): TrendResult {
    if (points.length < 2) {
        return { slope: 0, direction: "stable", rSquared: 0, prediction: 0 };
    }

    const n = points.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    let sumY2 = 0;

    for (let i = 0; i < n; i++) {
        const x = points[i].timestamp;
        const y = points[i].value;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
        sumY2 += y * y;
    }

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) {
        return { slope: 0, direction: "stable", rSquared: 0, prediction: mean(points.map((p) => p.value)) };
    }

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    // R-squared
    const yMean = sumY / n;
    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < n; i++) {
        const predicted = slope * points[i].timestamp + intercept;
        ssRes += (points[i].value - predicted) ** 2;
        ssTot += (points[i].value - yMean) ** 2;
    }
    const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

    // Prediction: next point timestamp estimated as last + avg step
    const avgStep = (points[n - 1].timestamp - points[0].timestamp) / (n - 1);
    const nextTimestamp = points[n - 1].timestamp + avgStep;
    const prediction = slope * nextTimestamp + intercept;

    // Direction determination using a normalized threshold
    const valueRange = Math.max(...points.map((p) => p.value)) - Math.min(...points.map((p) => p.value));
    const normalizedSlope = valueRange > 0 ? (slope * avgStep) / valueRange : 0;

    let direction: RiskTrend;
    if (normalizedSlope > 0.05) {
        direction = "deteriorating";
    } else if (normalizedSlope < -0.05) {
        direction = "improving";
    } else {
        direction = "stable";
    }

    return { slope, direction, rSquared: Math.max(0, Math.min(1, rSquared)), prediction };
}

/**
 * Determine trend direction from time-series points.
 * @param threshold Normalized slope threshold (default 0.05).
 * Slope > threshold → deteriorating, < -threshold → improving, else stable.
 */
export function trendDirection(
    points: TimeSeriesPoint[],
    threshold: number = 0.05,
): RiskTrend {
    if (points.length < 2) return "stable";
    const result = linearRegression(points);
    const valueRange = Math.max(...points.map((p) => p.value)) - Math.min(...points.map((p) => p.value));
    const avgStep = (points[points.length - 1].timestamp - points[0].timestamp) / (points.length - 1);
    const normalizedSlope = valueRange > 0 ? (result.slope * avgStep) / valueRange : 0;

    if (normalizedSlope > threshold) return "deteriorating";
    if (normalizedSlope < -threshold) return "improving";
    return "stable";
}

// ============================================
// Rolling Analysis
// ============================================

/**
 * Compute rolling average sentiment over a sliding window.
 * Returns an array the same length as the input; positions before
 * the window fills use as many values as available.
 */
export function rollingSentiment(sentiments: number[], windowSize: number): number[] {
    if (sentiments.length === 0 || windowSize <= 0) return [];

    const result: number[] = [];
    for (let i = 0; i < sentiments.length; i++) {
        const start = Math.max(0, i - windowSize + 1);
        let sum = 0;
        const count = i - start + 1;
        for (let j = start; j <= i; j++) {
            sum += sentiments[j];
        }
        result.push(sum / count);
    }
    return result;
}

/**
 * Compute rolling z-scores over a sliding window.
 * Each element is scored against the preceding windowSize values.
 * Returns an array the same length as the input.
 */
export function rollingZScore(values: number[], windowSize: number): ZScoreResult[] {
    if (values.length === 0 || windowSize <= 0) return [];

    const results: ZScoreResult[] = [];
    for (let i = 0; i < values.length; i++) {
        const start = Math.max(0, i - windowSize);
        const window = values.slice(start, i + 1);
        results.push(zScoreWithThreshold(values[i], window, 2.0));
    }
    return results;
}

// ============================================
// Spatial Analysis
// ============================================

/**
 * Kernel Density Estimation using Gaussian kernel with haversine distance.
 * Computes density at each input point relative to all other points.
 * @param bandwidth Kernel bandwidth in kilometers.
 */
export function kernelDensityEstimate(
    points: { lat: number; lng: number }[],
    bandwidth: number,
): KernelDensityResult[] {
    if (points.length === 0 || bandwidth <= 0) return [];

    const results: KernelDensityResult[] = [];

    for (let i = 0; i < points.length; i++) {
        let density = 0;

        for (let j = 0; j < points.length; j++) {
            if (i === j) continue;
            const distance = haversineKm(
                points[i].lat,
                points[i].lng,
                points[j].lat,
                points[j].lng,
            );
            // Gaussian kernel: exp(-0.5 * (d / h)^2)
            const u = distance / bandwidth;
            density += Math.exp(-0.5 * u * u);
        }

        // Normalize by count and bandwidth
        density /= points.length * bandwidth;

        results.push({
            center: { lat: points[i].lat, lng: points[i].lng },
            density,
            bandwidth,
        });
    }

    return results;
}

// ============================================
// Event Frequency
// ============================================

/**
 * Count events per time window. Returns an array of counts,
 * one per window from the earliest to latest timestamp.
 * @param timestamps Unix timestamps in milliseconds.
 * @param windowMs Window size in milliseconds.
 */
export function eventFrequency(timestamps: number[], windowMs: number): number[] {
    if (timestamps.length === 0 || windowMs <= 0) return [];

    const sorted = [...timestamps].sort((a, b) => a - b);
    const minTime = sorted[0];
    const maxTime = sorted[sorted.length - 1];
    const windowCount = Math.ceil((maxTime - minTime) / windowMs) + 1;

    const counts = new Array<number>(windowCount).fill(0);
    for (const ts of sorted) {
        const idx = Math.floor((ts - minTime) / windowMs);
        counts[idx]++;
    }

    return counts;
}

/**
 * Rate of change in event frequency.
 * Compares frequency in the most recent half vs the older half.
 * Returns ratio (recent / older). >1 = accelerating, <1 = decelerating.
 * Returns 1 (no change) for insufficient data.
 */
export function eventAcceleration(timestamps: number[], windowMs: number): number {
    const freqs = eventFrequency(timestamps, windowMs);
    if (freqs.length < 2) return 1;

    const mid = Math.floor(freqs.length / 2);
    const olderSlice = freqs.slice(0, mid);
    const recentSlice = freqs.slice(mid);

    const olderMean = mean(olderSlice);
    const recentMean = mean(recentSlice);

    if (olderMean === 0) {
        return recentMean > 0 ? recentMean + 1 : 1;
    }

    return recentMean / olderMean;
}
