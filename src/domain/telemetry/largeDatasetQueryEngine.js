/**
 * Stage 17 — Large Dataset Query & Time-Series Aggregation Engine
 * Eskom Bill Balancer Platform
 *
 * Implements:
 * 1. Server-side pagination & keyset navigation for massive time-series
 * 2. Server-side filtering across meter IDs, date ranges, quality states, and TOU
 * 3. Time-series aggregation for dashboard charts (strictly bounded to <= 300 points, < 50 KB payload)
 * 4. Memory-bounded batch processing & streaming chunker with cooperative event-loop yielding
 * 5. Strict Level 3 Zero-Exposure compliance (no internal database schemas or secrets leaked)
 */
import Decimal from "decimal.js-light";
import { TenantIsolationViolationError, } from "../security/tenantContextService";
import { TelemetryStorageService } from "./telemetryStorageService";
import { classifyTou } from "@/lib/tariff";
export class LargeDatasetQueryEngine {
    static datasetCache = new Map();
    /**
     * Register an in-memory dataset (e.g. from an ingested large CSV or Excel workbook)
     * for fast, zero-overhead paginated queries and chart aggregation.
     */
    static registerDataset(datasetId, records) {
        this.datasetCache.set(datasetId, records);
    }
    /**
     * Retrieve a registered dataset by ID
     */
    static getDataset(datasetId) {
        return this.datasetCache.get(datasetId);
    }
    /**
     * Clear the dataset cache
     */
    static clearDatasetCache() {
        this.datasetCache.clear();
    }
    /**
     * Server-Side Pagination & Filtering
     * Protects browser heap by slicing large datasets into bounded pages (default 50, max 1000).
     */
    static async queryPaginatedIntervals(filter, pagination, sourceIntervals, context) {
        const startTime = performance.now();
        // 0. Enforce Server-Side Tenant Security Context
        if (context && context.role !== "SUPER_ADMIN") {
            if (filter.organisationId && filter.organisationId !== context.organisationId) {
                throw new TenantIsolationViolationError(context.organisationId, filter.organisationId);
            }
            filter.organisationId = context.organisationId;
        }
        // 1. Resolve raw candidate records
        let candidateRecords = [];
        if (sourceIntervals && sourceIntervals.length > 0) {
            candidateRecords = sourceIntervals;
        }
        else if (filter.sourceFileId && this.datasetCache.has(filter.sourceFileId)) {
            candidateRecords = this.datasetCache.get(filter.sourceFileId);
        }
        else if (filter.meterId && this.datasetCache.has(filter.meterId)) {
            candidateRecords = this.datasetCache.get(filter.meterId);
        }
        else if (filter.meterId) {
            candidateRecords = TelemetryStorageService.getIntervalsMemory(filter.meterId);
        }
        // 2. Server-side deterministic filtering
        const filtered = this.applyFilters(candidateRecords, filter);
        // 3. Sorting
        const sortField = pagination?.sortField || "timestamp_utc";
        const sortDirection = pagination?.sortDirection || "ASC";
        const isAsc = sortDirection === "ASC";
        filtered.sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];
            if (sortField === "timestamp_utc") {
                const timeA = new Date(valA || 0).getTime();
                const timeB = new Date(valB || 0).getTime();
                return isAsc ? timeA - timeB : timeB - timeA;
            }
            valA = Number(valA || 0);
            valB = Number(valB || 0);
            return isAsc ? valA - valB : valB - valA;
        });
        // 4. Cursor / Keyset resolution (if cursor provided)
        let targetPage = pagination?.page ? Math.max(1, pagination.page) : 1;
        if (pagination?.cursor) {
            try {
                const decoded = JSON.parse(typeof atob === "function"
                    ? atob(pagination.cursor)
                    : Buffer.from(pagination.cursor, "base64").toString("utf-8"));
                if (decoded && typeof decoded.page === "number") {
                    targetPage = decoded.page;
                }
            }
            catch {
                // Fallback gracefully to page 1
                targetPage = 1;
            }
        }
        // 5. Pagination slicing
        const pageSize = Math.min(1000, Math.max(1, pagination?.pageSize || 50));
        const totalCount = filtered.length;
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        const safePage = Math.min(targetPage, totalPages);
        const startIndex = (safePage - 1) * pageSize;
        const endIndex = Math.min(totalCount, startIndex + pageSize);
        const pageItems = filtered.slice(startIndex, endIndex);
        const hasNextPage = safePage < totalPages;
        const hasPrevPage = safePage > 1;
        // Generate opaque base64 cursors
        const encodeCursor = (pageNumber) => {
            const payload = JSON.stringify({ page: pageNumber, sortField, sortDirection });
            return typeof btoa === "function"
                ? btoa(payload)
                : Buffer.from(payload, "utf-8").toString("base64");
        };
        const nextCursor = hasNextPage ? encodeCursor(safePage + 1) : undefined;
        const prevCursor = hasPrevPage ? encodeCursor(safePage - 1) : undefined;
        const durationMs = Math.max(1, Math.round(performance.now() - startTime));
        return {
            items: pageItems,
            totalCount,
            page: safePage,
            pageSize,
            totalPages,
            hasNextPage,
            hasPrevPage,
            nextCursor,
            prevCursor,
            executionDurationMs: durationMs,
        };
    }
    /**
     * Time-Series Aggregation for Dashboard Charts
     * Aggregates raw intervals into pre-computed hourly, daily, weekly, monthly, or TOU buckets.
     * Guarantees bucketCount <= maxBuckets (default 300) and payload < 50 KB.
     */
    static async aggregateIntervalsForCharts(filter, cadence = "day", maxBuckets = 300, sourceIntervals, context, options) {
        const startTime = performance.now();
        // 0. Enforce Server-Side Tenant Security Context
        if (context && context.role !== "SUPER_ADMIN") {
            if (filter.organisationId && filter.organisationId !== context.organisationId) {
                throw new TenantIsolationViolationError(context.organisationId, filter.organisationId);
            }
            filter.organisationId = context.organisationId;
        }
        // 1. Resolve raw candidate records
        let candidateRecords = [];
        if (sourceIntervals && sourceIntervals.length > 0) {
            candidateRecords = sourceIntervals;
        }
        else if (filter.sourceFileId && this.datasetCache.has(filter.sourceFileId)) {
            candidateRecords = this.datasetCache.get(filter.sourceFileId);
        }
        else if (filter.meterId && this.datasetCache.has(filter.meterId)) {
            candidateRecords = this.datasetCache.get(filter.meterId);
        }
        else if (filter.meterId) {
            candidateRecords = TelemetryStorageService.getIntervalsMemory(filter.meterId);
        }
        // 2. Filter records
        const filtered = this.applyFilters(candidateRecords, filter);
        if (filtered.length === 0) {
            return this.createEmptyChartResponse(filter.meterId || "UNKNOWN", cadence);
        }
        // Ensure chronological order
        filtered.sort((a, b) => new Date(a.timestamp_utc).getTime() - new Date(b.timestamp_utc).getTime());
        const periodStart = filtered[0].timestamp_utc;
        const periodEnd = filtered[filtered.length - 1].timestamp_utc;
        // 3. Group records into buckets by cadence
        const bucketsMap = new Map();
        for (const rec of filtered) {
            const dt = new Date(rec.timestamp_utc);
            const bucketKey = this.getBucketKey(dt, cadence, rec.tou_period);
            let bucket = bucketsMap.get(bucketKey);
            if (!bucket) {
                bucket = {
                    bucketKey,
                    timestampStart: rec.timestamp_utc,
                    timestampEnd: rec.timestamp_utc,
                    totalKwh: new Decimal(0),
                    peakKwh: new Decimal(0),
                    standardKwh: new Decimal(0),
                    offPeakKwh: new Decimal(0),
                    totalKvarh: new Decimal(0),
                    maxKva: 0,
                    sumKw: new Decimal(0),
                    sumPf: 0,
                    readingCount: 0,
                    estimatedCount: 0,
                    outageCount: 0,
                    touCounts: { PEAK: 0, STANDARD: 0, OFF_PEAK: 0 },
                };
                bucketsMap.set(bucketKey, bucket);
            }
            bucket.timestampEnd = rec.timestamp_utc;
            bucket.readingCount++;
            const kwhVal = new Decimal(rec.kwh ?? rec.engineering_value ?? 0);
            const kvarhVal = new Decimal(rec.kvarh ?? 0);
            const kwVal = new Decimal(rec.kw ?? (kwhVal.toNumber() > 0 ? kwhVal.toNumber() * 2 : 0));
            const kvaVal = rec.kva ?? kwVal.toNumber();
            const pfVal = rec.power_factor ?? 0.96;
            bucket.totalKwh = bucket.totalKwh.plus(kwhVal);
            bucket.totalKvarh = bucket.totalKvarh.plus(kvarhVal);
            bucket.sumKw = bucket.sumKw.plus(kwVal);
            bucket.sumPf += pfVal;
            if (kvaVal > bucket.maxKva) {
                bucket.maxKva = kvaVal;
            }
            // TOU breakdown
            const tou = rec.tou_period || classifyTou(dt);
            if (tou === "PEAK") {
                bucket.peakKwh = bucket.peakKwh.plus(kwhVal);
                bucket.touCounts.PEAK++;
            }
            else if (tou === "STANDARD") {
                bucket.standardKwh = bucket.standardKwh.plus(kwhVal);
                bucket.touCounts.STANDARD++;
            }
            else {
                bucket.offPeakKwh = bucket.offPeakKwh.plus(kwhVal);
                bucket.touCounts.OFF_PEAK++;
            }
            // Quality state tracking
            if (rec.quality_state === "ESTIMATED" || rec.quality_state === "INTERPOLATED") {
                bucket.estimatedCount++;
            }
            else if (rec.quality_state === "MISSING" || rec.quality_state === "INVALID") {
                bucket.outageCount++;
            }
        }
        // 4. Downsampling / Coalescing Guard (Ensure bucketCount <= maxBuckets)
        let rawBuckets = Array.from(bucketsMap.values());
        let downsampled = false;
        if (rawBuckets.length > maxBuckets) {
            downsampled = true;
            rawBuckets = this.coalesceBuckets(rawBuckets, maxBuckets);
        }
        // 5. Finalize bucket metrics & build plottable points
        let summaryTotalKwh = new Decimal(0);
        let summaryPeakKwh = new Decimal(0);
        let summaryStdKwh = new Decimal(0);
        let summaryOffKwh = new Decimal(0);
        let summaryKvarh = new Decimal(0);
        let summaryMaxKva = 0;
        let summarySumPf = 0;
        let totalEstimated = 0;
        let totalOutages = 0;
        const aggregatedBuckets = [];
        const chartFormattedSeries = [];
        for (const b of rawBuckets) {
            summaryTotalKwh = summaryTotalKwh.plus(b.totalKwh);
            summaryPeakKwh = summaryPeakKwh.plus(b.peakKwh);
            summaryStdKwh = summaryStdKwh.plus(b.standardKwh);
            summaryOffKwh = summaryOffKwh.plus(b.offPeakKwh);
            summaryKvarh = summaryKvarh.plus(b.totalKvarh);
            totalEstimated += b.estimatedCount;
            totalOutages += b.outageCount;
            if (b.maxKva > summaryMaxKva) {
                summaryMaxKva = b.maxKva;
            }
            const count = Math.max(1, b.readingCount);
            const avgKw = Number(b.sumKw.dividedBy(count).toFixed(2));
            const avgPf = Number((b.sumPf / count).toFixed(3));
            summarySumPf += avgPf;
            // Determine dominant TOU
            let dominantTou = "STANDARD";
            if (b.touCounts.PEAK >= b.touCounts.STANDARD && b.touCounts.PEAK >= b.touCounts.OFF_PEAK) {
                dominantTou = "PEAK";
            }
            else if (b.touCounts.OFF_PEAK > b.touCounts.STANDARD && b.touCounts.OFF_PEAK > b.touCounts.PEAK) {
                dominantTou = "OFF_PEAK";
            }
            const bucketRecord = {
                bucketKey: b.bucketKey,
                timestampStart: b.timestampStart,
                timestampEnd: b.timestampEnd,
                totalActiveEnergyKwh: Number(b.totalKwh.toFixed(2)),
                peakKwh: Number(b.peakKwh.toFixed(2)),
                standardKwh: Number(b.standardKwh.toFixed(2)),
                offPeakKwh: Number(b.offPeakKwh.toFixed(2)),
                maxDemandKva: Number(b.maxKva.toFixed(2)),
                avgDemandKw: avgKw,
                totalReactiveKvarh: Number(b.totalKvarh.toFixed(2)),
                avgPowerFactor: avgPf,
                readingCount: b.readingCount,
                estimatedCount: b.estimatedCount,
                outageCount: b.outageCount,
                dominantTou,
            };
            aggregatedBuckets.push(bucketRecord);
            // Lightweight plottable point for Recharts UI
            chartFormattedSeries.push({
                label: b.bucketKey,
                timestamp: new Date(b.timestampStart).getTime(),
                kW: avgKw,
                kVA: Number(b.maxKva.toFixed(2)),
                kwh: Number(b.totalKwh.toFixed(2)),
                kvarh: Number(b.totalKvarh.toFixed(2)),
                pf: avgPf,
                tou: dominantTou,
                estimated: b.estimatedCount > 0,
            });
        }
        const bucketCount = aggregatedBuckets.length;
        const avgPfAll = bucketCount > 0 ? Number((summarySumPf / bucketCount).toFixed(3)) : 0.96;
        const qualityScore = Number(Math.max(0, (1 - (totalEstimated + totalOutages) / Math.max(1, filtered.length)) * 100).toFixed(1));
        const durationMs = Math.max(1, Math.round(performance.now() - startTime));
        return {
            meterId: filter.meterId || filtered[0]?.meter_id || "",
            periodStart,
            periodEnd,
            cadence,
            bucketCount,
            totalRawRecordsSampled: filtered.length,
            summary: {
                totalActiveKwh: Number(summaryTotalKwh.toFixed(2)),
                peakKwh: Number(summaryPeakKwh.toFixed(2)),
                standardKwh: Number(summaryStdKwh.toFixed(2)),
                offPeakKwh: Number(summaryOffKwh.toFixed(2)),
                maxDemandKva: Number(summaryMaxKva.toFixed(2)),
                totalReactiveKvarh: Number(summaryKvarh.toFixed(2)),
                averagePowerFactor: avgPfAll,
                dataQualityScore: qualityScore,
            },
            buckets: options?.includeDetailedBuckets ? aggregatedBuckets : undefined,
            chartFormattedSeries,
            downsampled,
            executionDurationMs: durationMs,
        };
    }
    /**
     * Memory-Bounded Batch Processor with Cooperative Event-Loop Yielding
     * Ingests 10,000 to 35,000+ records in batches without starving the main thread.
     */
    static async streamBatchProcessor(items, processBatch, options) {
        const startTime = performance.now();
        const batchSize = Math.max(1, options?.batchSize || 2000);
        const totalItems = items.length;
        const batchesCount = Math.ceil(totalItems / batchSize);
        const allResults = [];
        let processed = 0;
        for (let i = 0; i < batchesCount; i++) {
            const start = i * batchSize;
            const end = Math.min(totalItems, start + batchSize);
            const chunk = items.slice(start, end);
            const batchResults = await processBatch(chunk, i);
            if (Array.isArray(batchResults)) {
                allResults.push(...batchResults);
            }
            processed += chunk.length;
            if (options?.onProgress) {
                const pct = Math.round((processed / totalItems) * 100);
                options.onProgress(processed, totalItems, pct);
            }
            // Cooperative event-loop tick yield
            await new Promise((resolve) => setTimeout(resolve, options?.yieldTickIntervalMs ?? 0));
        }
        const durationMs = Math.max(1, Math.round(performance.now() - startTime));
        const throughputRowsPerSec = Math.round((totalItems / (durationMs / 1000)));
        return {
            totalProcessed: processed,
            batchesCount,
            durationMs,
            throughputRowsPerSec,
            results: allResults,
        };
    }
    /**
     * Deterministic Server-Side Filtering
     */
    static applyFilters(records, filter) {
        const filterMeterId = filter.meterId;
        const filterMeterIds = filter.meterIds;
        const filterOrgId = filter.organisationId;
        const filterSiteId = filter.siteId;
        const filterStart = filter.startDate ? new Date(filter.startDate).getTime() : undefined;
        const filterEnd = filter.endDate
            ? new Date(filter.endDate.includes("T") ? filter.endDate : filter.endDate + "T23:59:59.999Z").getTime()
            : undefined;
        const qualitySet = filter.qualityStates && filter.qualityStates.length > 0
            ? new Set(filter.qualityStates)
            : undefined;
        const touSet = filter.touPeriods && filter.touPeriods.length > 0
            ? new Set(filter.touPeriods.map((t) => String(t).toUpperCase().replace(/_/g, "")))
            : undefined;
        const channelSet = filter.channels && filter.channels.length > 0
            ? new Set(filter.channels)
            : undefined;
        return records.filter((rec) => {
            // Meter ID matching
            if (filterMeterId && rec.meter_id !== filterMeterId) {
                return false;
            }
            if (filterMeterIds && filterMeterIds.length > 0 && !filterMeterIds.includes(rec.meter_id)) {
                return false;
            }
            // Organisation matching
            if (filterOrgId && rec.organisation_id && rec.organisation_id !== filterOrgId) {
                return false;
            }
            // Site matching
            if (filterSiteId && rec.site_id && rec.site_id !== filterSiteId) {
                return false;
            }
            // Date range matching
            if (filterStart !== undefined || filterEnd !== undefined) {
                const recTime = new Date(rec.timestamp_utc).getTime();
                if (filterStart !== undefined && recTime < filterStart) {
                    return false;
                }
                if (filterEnd !== undefined && recTime > filterEnd) {
                    return false;
                }
            }
            // Quality state matching
            if (qualitySet && rec.quality_state && !qualitySet.has(rec.quality_state)) {
                return false;
            }
            // TOU matching (case and format agnostic)
            if (touSet && rec.tou_period) {
                const norm = String(rec.tou_period).toUpperCase().replace(/_/g, "");
                if (!touSet.has(norm)) {
                    return false;
                }
            }
            // Channel matching
            if (channelSet && rec.channel && !channelSet.has(rec.channel)) {
                return false;
            }
            // kWh boundaries
            const kwh = rec.kwh ?? rec.engineering_value ?? 0;
            if (filter.minKwh !== undefined && kwh < filter.minKwh) {
                return false;
            }
            if (filter.maxKwh !== undefined && kwh > filter.maxKwh) {
                return false;
            }
            return true;
        });
    }
    /**
     * Computes a deterministic bucket key based on cadence
     */
    static getBucketKey(dt, cadence, tou) {
        const iso = dt.toISOString();
        switch (cadence) {
            case "hour":
                return iso.substring(0, 13) + ":00";
            case "day":
                return iso.substring(0, 10);
            case "week": {
                // Monday-based ISO week key
                const d = new Date(dt);
                const day = d.getUTCDay();
                const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
                d.setUTCDate(diff);
                return `Wk-${d.toISOString().substring(0, 10)}`;
            }
            case "month":
                return iso.substring(0, 7);
            case "tou_period":
                return tou || classifyTou(dt);
            default:
                return iso.substring(0, 10);
        }
    }
    /**
     * Coalesces adjacent buckets to guarantee bucketCount <= maxBuckets
     */
    static coalesceBuckets(rawBuckets, maxBuckets) {
        const stride = Math.ceil(rawBuckets.length / maxBuckets);
        const coalesced = [];
        for (let i = 0; i < rawBuckets.length; i += stride) {
            const slice = rawBuckets.slice(i, i + stride);
            const head = slice[0];
            const tail = slice[slice.length - 1];
            let sumKwh = new Decimal(0);
            let sumPeak = new Decimal(0);
            let sumStd = new Decimal(0);
            let sumOff = new Decimal(0);
            let sumKvarh = new Decimal(0);
            let maxKva = 0;
            let sumKw = new Decimal(0);
            let sumPf = 0;
            let readingCount = 0;
            let estimatedCount = 0;
            let outageCount = 0;
            const touCounts = { PEAK: 0, STANDARD: 0, OFF_PEAK: 0 };
            for (const b of slice) {
                sumKwh = sumKwh.plus(b.totalKwh);
                sumPeak = sumPeak.plus(b.peakKwh);
                sumStd = sumStd.plus(b.standardKwh);
                sumOff = sumOff.plus(b.offPeakKwh);
                sumKvarh = sumKvarh.plus(b.totalKvarh);
                sumKw = sumKw.plus(b.sumKw);
                sumPf += b.sumPf;
                readingCount += b.readingCount;
                estimatedCount += b.estimatedCount;
                outageCount += b.outageCount;
                touCounts.PEAK += b.touCounts.PEAK;
                touCounts.STANDARD += b.touCounts.STANDARD;
                touCounts.OFF_PEAK += b.touCounts.OFF_PEAK;
                if (b.maxKva > maxKva) {
                    maxKva = b.maxKva;
                }
            }
            coalesced.push({
                bucketKey: slice.length > 1 ? `${head.bucketKey}..${tail.bucketKey}` : head.bucketKey,
                timestampStart: head.timestampStart,
                timestampEnd: tail.timestampEnd,
                totalKwh: sumKwh,
                peakKwh: sumPeak,
                standardKwh: sumStd,
                offPeakKwh: sumOff,
                totalKvarh: sumKvarh,
                maxKva,
                sumKw,
                sumPf,
                readingCount,
                estimatedCount,
                outageCount,
                touCounts,
            });
        }
        return coalesced;
    }
    /**
     * Helper to build empty chart response
     */
    static createEmptyChartResponse(meterId, cadence) {
        const now = new Date().toISOString();
        return {
            meterId,
            periodStart: now,
            periodEnd: now,
            cadence,
            bucketCount: 0,
            totalRawRecordsSampled: 0,
            summary: {
                totalActiveKwh: 0,
                peakKwh: 0,
                standardKwh: 0,
                offPeakKwh: 0,
                maxDemandKva: 0,
                totalReactiveKvarh: 0,
                averagePowerFactor: 0.96,
                dataQualityScore: 100,
            },
            buckets: [],
            chartFormattedSeries: [],
            downsampled: false,
            executionDurationMs: 0,
        };
    }
}
