/**
 * AMR / CSV / Excel Ingestion Engine (Stage 9)
 *
 * Implements the 13 sequential requirements for interval telemetry ingestion:
 *  1. Store original file (anchored via FileStorageSecurityService)
 *  2. Detect file structure (delimiter, encoding, sheet names, preamble rows)
 *  3. Detect headers (locates tabular column header row past metadata preamble)
 *  4. Identify timestamp column (combined DateTime or split Date + Time, ISO, slash, serial)
 *  5. Identify meter identifier (from columns, preamble metadata, or filename)
 *  6. Identify energy fields across diverse vendor schemas (kW, kWh, kVAR, kVA, PF, dial registers)
 *  7. Detect interval duration (15m, 30m, 60m, 5m via timestamp delta analysis)
 *  8. Validate timestamps (chronological re-sorting, timezone mapping to SAST/UTC)
 *  9. Detect duplicates (tracking identical timestamps, counting duplicates, marking state)
 * 10. Detect gaps (calculating missing intervals, gap duration, quality impact, gap events)
 * 11. Normalise units (converts MWh/Wh to kWh, MW/W to kW, derives kVA and PF)
 * 12. Store validated records (canonical and backwards-compatible format)
 * 13. Create processing summary (comprehensive diagnostics, detected schema, totals)
 */
import * as XLSX from "xlsx";
import { CANONICAL_NORMALISED_UNITS, } from "./canonicalEnergyRecord";
import { classifyTou } from "@/lib/tariff";
export class AmrIntervalIngestionEngine {
    /**
     * Static async wrapper supporting parameter objects for Stage 17 & batch processors
     */
    static async processIntervalFile(params) {
        return this.processIntervalStream(params.filename, params.fileBuffer, {
            meterIdOverride: params.meterIdOverride,
            sourceFileId: params.sourceFileId,
        });
    }
    /**
     * Main ingestion entrypoint handling CSV text, Excel workbooks, or binary buffers
     */
    static processIntervalStream(filename, contentOrBuffer, options) {
        const errors = [];
        const warnings = [];
        // Step 2 & 3: File Structure & Header Detection
        const parsedStructure = this.detectStructureAndParseRows(filename, contentOrBuffer);
        if (parsedStructure.error) {
            errors.push(parsedStructure.error);
            return this.createFailureResult(filename, parsedStructure, errors, warnings);
        }
        const { fileStructure, headerRow, dataRows } = parsedStructure;
        if (dataRows.length === 0) {
            errors.push("EMPTY_TELEMETRY_DATASET: The uploaded file contains no interval data rows.");
            return this.createFailureResult(filename, parsedStructure, errors, warnings);
        }
        // Step 3 & 4: Header & Timestamp Column Identification
        const detectedHeaders = this.identifyColumns(headerRow, fileStructure.headerRowIndex);
        if (!detectedHeaders.timestampColumn &&
            !(detectedHeaders.dateColumn && detectedHeaders.timeColumn)) {
            errors.push("NO_TIMESTAMP_COLUMN_DETECTED: Could not identify a valid Date/Time column in file headers.");
            return this.createFailureResult(filename, parsedStructure, errors, warnings, detectedHeaders);
        }
        // Step 6: Identify Energy Fields
        const hasEnergyFields = Boolean(detectedHeaders.activePowerColumn) ||
            Boolean(detectedHeaders.activeEnergyColumn) ||
            Boolean(detectedHeaders.cumulativeRegisterColumn);
        if (!hasEnergyFields) {
            errors.push("NO_ENERGY_COLUMNS_DETECTED: No active power (kW), energy (kWh), or register dial columns found in file headers.");
            return this.createFailureResult(filename, parsedStructure, errors, warnings, detectedHeaders);
        }
        // Step 5: Identify Meter Identifier
        const detectedMeterId = this.identifyMeter(filename, fileStructure.preambleLines, detectedHeaders, dataRows, options?.meterId);
        // Parse raw rows and extract timestamps & raw numeric values
        const rawParsedRows = [];
        let unparseableTimestampCount = 0;
        for (let idx = 0; idx < dataRows.length; idx++) {
            const row = dataRows[idx];
            const parsedTs = this.parseTimestamp(row, detectedHeaders, options?.defaultTimezone);
            if (!parsedTs || isNaN(parsedTs.dateObj.getTime())) {
                unparseableTimestampCount++;
                continue;
            }
            const rawKw = detectedHeaders.activePowerColumn
                ? this.parseNumber(row[detectedHeaders.activePowerColumn])
                : undefined;
            const rawKwh = detectedHeaders.activeEnergyColumn
                ? this.parseNumber(row[detectedHeaders.activeEnergyColumn])
                : undefined;
            const rawKvar = detectedHeaders.reactiveEnergyColumn
                ? this.parseNumber(row[detectedHeaders.reactiveEnergyColumn])
                : undefined;
            const rawKva = detectedHeaders.apparentPowerColumn
                ? this.parseNumber(row[detectedHeaders.apparentPowerColumn])
                : undefined;
            const rawPf = detectedHeaders.powerFactorColumn
                ? this.parseNumber(row[detectedHeaders.powerFactorColumn])
                : undefined;
            const rawCumulative = detectedHeaders.cumulativeRegisterColumn
                ? this.parseNumber(row[detectedHeaders.cumulativeRegisterColumn])
                : undefined;
            rawParsedRows.push({
                rowNumber: fileStructure.headerRowIndex + 1 + idx,
                dateObj: parsedTs.dateObj,
                localTs: parsedTs.localTs,
                isoUtc: parsedTs.isoUtc,
                rawKw,
                rawKwh,
                rawKvar,
                rawKva,
                rawPf,
                rawCumulative,
                rawRow: row,
            });
        }
        if (rawParsedRows.length === 0) {
            errors.push("INVALID_TIMESTAMPS: None of the rows contained a parseable date/time value.");
            return this.createFailureResult(filename, parsedStructure, errors, warnings, detectedHeaders);
        }
        if (unparseableTimestampCount > 0) {
            warnings.push(`Skipped ${unparseableTimestampCount} rows with unparseable timestamps.`);
        }
        // Step 8: Validate Timestamps & Sort Chronologically
        let wasReordered = false;
        for (let i = 0; i < rawParsedRows.length - 1; i++) {
            if (rawParsedRows[i].dateObj.getTime() > rawParsedRows[i + 1].dateObj.getTime()) {
                wasReordered = true;
                break;
            }
        }
        rawParsedRows.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
        if (wasReordered) {
            warnings.push("TIMESTAMPS_REORDERED: Telemetry records were sorted into chronological order.");
        }
        // Step 7: Detect Interval Duration (15m, 30m, 60m, 5m)
        const detectedDurationMinutes = this.detectIntervalDuration(rawParsedRows.map((r) => r.dateObj));
        const intervalMs = detectedDurationMinutes * 60 * 1000;
        // Detect Schema Type
        const schemaType = this.classifySchema(detectedHeaders, detectedDurationMinutes, rawParsedRows);
        // Step 9 & 10 & 11: Deduplication, Gap Detection, and Unit Normalisation
        const records = [];
        const gapEvents = [];
        const missingGapRecords = [];
        const missingIntervalDetails = [];
        const seenTimestamps = new Set();
        let duplicateCount = 0;
        let estimatedCount = 0;
        let suspectCount = 0;
        let rolloverCount = 0;
        const MAX_DIAL_CAP = 1000000; // 1M dial reset ceiling
        for (let i = 0; i < rawParsedRows.length; i++) {
            const current = rawParsedRows[i];
            const isoUtc = current.isoUtc;
            const localTs = current.localTs;
            let qualityStatus = "measured";
            // Step 9: Duplicate Detection
            if (seenTimestamps.has(isoUtc)) {
                duplicateCount++;
                qualityStatus = "duplicate";
            }
            else {
                seenTimestamps.add(isoUtc);
            }
            // Step 11: Unit Normalisation
            let activeEnergyKwh = 0;
            let activePowerKw = 0;
            let reactiveKvarh = 0;
            let reactivePowerKvar = 0;
            // Case A: Cumulative Dial Register (forward delta: reading[i+1] - reading[i])
            if (current.rawCumulative !== undefined &&
                (current.rawKw === undefined || isNaN(current.rawKw))) {
                if (i < rawParsedRows.length - 1) {
                    const currVal = current.rawCumulative ?? 0;
                    const nextVal = rawParsedRows[i + 1].rawCumulative ?? 0;
                    if (nextVal < currVal) {
                        rolloverCount++;
                        qualityStatus = "rollover";
                        const delta = MAX_DIAL_CAP - currVal + nextVal;
                        activeEnergyKwh = Math.max(0, delta);
                    }
                    else {
                        const delta = nextVal - currVal;
                        activeEnergyKwh = Math.max(0, delta);
                    }
                }
                else if (records.length > 0) {
                    // Last reading adopts the preceding interval's consumption
                    activeEnergyKwh = records[records.length - 1].active_energy_kwh;
                }
                activePowerKw = activeEnergyKwh * (60 / detectedDurationMinutes);
            }
            else {
                // Case B: Direct kW, MW, kWh, or MWh
                if (current.rawKw !== undefined && !isNaN(current.rawKw)) {
                    activePowerKw = current.rawKw;
                    const colName = detectedHeaders.activePowerColumn?.toLowerCase() || "";
                    if (colName.includes("mw") && !colName.includes("k")) {
                        activePowerKw *= 1000;
                    }
                    activeEnergyKwh =
                        current.rawKwh !== undefined && !isNaN(current.rawKwh)
                            ? current.rawKwh
                            : activePowerKw * (detectedDurationMinutes / 60);
                }
                else if (current.rawKwh !== undefined && !isNaN(current.rawKwh)) {
                    activeEnergyKwh = current.rawKwh;
                    const colName = detectedHeaders.activeEnergyColumn?.toLowerCase() || "";
                    if (colName.includes("mwh") && !colName.includes("k")) {
                        activeEnergyKwh *= 1000;
                    }
                    activePowerKw = activeEnergyKwh * (60 / detectedDurationMinutes);
                }
            }
            // Reactive Energy & Power (kVAR / kVARh / MVAR)
            if (current.rawKvar !== undefined && !isNaN(current.rawKvar)) {
                let kvarVal = current.rawKvar;
                const colName = detectedHeaders.reactiveEnergyColumn?.toLowerCase() || "";
                if (colName.includes("mvar") && !colName.includes("k")) {
                    kvarVal *= 1000;
                }
                if (colName.includes("kvarh") || colName.includes("mvarh")) {
                    reactiveKvarh = kvarVal;
                    reactivePowerKvar = kvarVal * (60 / detectedDurationMinutes);
                }
                else {
                    reactivePowerKvar = kvarVal;
                    reactiveKvarh = kvarVal * (detectedDurationMinutes / 60);
                }
            }
            // Apparent Power (kVA)
            let apparentPowerKva = current.rawKva !== undefined && !isNaN(current.rawKva) ? current.rawKva : 0;
            if (!apparentPowerKva || apparentPowerKva <= 0) {
                // Electrical formula: kVA = sqrt(kW^2 + kVAR^2)
                const kvarRate = reactivePowerKvar > 0
                    ? reactivePowerKvar
                    : reactiveKvarh * (60 / detectedDurationMinutes);
                apparentPowerKva = Math.sqrt(activePowerKw * activePowerKw + kvarRate * kvarRate);
            }
            // Power Factor (PF)
            let powerFactor = current.rawPf !== undefined && !isNaN(current.rawPf) ? current.rawPf : 0;
            if (!powerFactor || powerFactor <= 0) {
                powerFactor = apparentPowerKva > 0 ? Math.min(1.0, activePowerKw / apparentPowerKva) : 0.96;
            }
            if (activePowerKw < 0 || activeEnergyKwh < 0) {
                suspectCount++;
                qualityStatus = "suspect";
                activePowerKw = Math.max(0, activePowerKw);
                activeEnergyKwh = Math.max(0, activeEnergyKwh);
            }
            // Source units detection from header columns
            const pCol = detectedHeaders.activePowerColumn?.toLowerCase() || "";
            const eCol = detectedHeaders.activeEnergyColumn?.toLowerCase() || "";
            const rpCol = detectedHeaders.reactiveEnergyColumn?.toLowerCase() || "";
            const apCol = detectedHeaders.apparentPowerColumn?.toLowerCase() || "";
            const activePowerUnit = pCol.includes("mw")
                ? "MW"
                : pCol.includes("w") && !pCol.includes("k")
                    ? "W"
                    : "kW";
            const activeEnergyUnit = eCol.includes("mwh")
                ? "MWh"
                : eCol.includes("wh") && !eCol.includes("k")
                    ? "Wh"
                    : "kWh";
            const reactivePowerUnit = rpCol.includes("mvar")
                ? "MVAR"
                : rpCol.includes("var") && !rpCol.includes("k")
                    ? "VAR"
                    : "kvar";
            const reactiveEnergyUnit = rpCol.includes("mvarh")
                ? "MVARh"
                : rpCol.includes("varh") && !rpCol.includes("k")
                    ? "VARh"
                    : "kvarh";
            const apparentPowerUnit = apCol.includes("mva")
                ? "MVA"
                : apCol.includes("va") && !apCol.includes("k")
                    ? "VA"
                    : "kVA";
            const normKw = Number(activePowerKw.toFixed(4));
            const normKwh = Number(activeEnergyKwh.toFixed(4));
            const normKva = Number(apparentPowerKva.toFixed(4));
            const normKvah = Number((apparentPowerKva * (detectedDurationMinutes / 60)).toFixed(4));
            const normKvar = Number(reactivePowerKvar.toFixed(4));
            const normKvarh = Number(reactiveKvarh.toFixed(4));
            const normPf = Number(powerFactor.toFixed(4));
            // Time-of-Use Classification & Decomposition
            const touPeriod = classifyTou(current.dateObj);
            let peakKwh = 0;
            let standardKwh = 0;
            let offPeakKwh = 0;
            if (touPeriod === "peak") {
                peakKwh = normKwh;
            }
            else if (touPeriod === "standard") {
                standardKwh = normKwh;
            }
            else {
                offPeakKwh = normKwh;
            }
            const record = {
                // Identity & Cadence
                timestamp: isoUtc,
                timestamp_utc: isoUtc,
                local_timestamp: localTs,
                timezone: options?.defaultTimezone || "Africa/Johannesburg",
                source_timezone: options?.defaultTimezone || "Africa/Johannesburg",
                meter_id: detectedHeaders.meterColumn && current.rawRow?.[detectedHeaders.meterColumn]
                    ? String(current.rawRow[detectedHeaders.meterColumn]).trim()
                    : detectedMeterId,
                site_id: options?.organisationId
                    ? `${options.organisationId}-${detectedMeterId}`
                    : `site-${detectedMeterId}`,
                interval_minutes: detectedDurationMinutes,
                interval_duration_minutes: detectedDurationMinutes,
                // Normalised Energy
                kwh: normKwh,
                kvah: normKvah,
                peak_kwh: peakKwh,
                standard_kwh: standardKwh,
                off_peak_kwh: offPeakKwh,
                kvarh: normKvarh,
                // Normalised Power Demand
                kw: normKw,
                kva: normKva,
                kvar: normKvar,
                // Power Quality
                power_factor: normPf,
                // Classification
                tou_period: touPeriod,
                // Explicit Unit Metadata & Lineage
                source_units: {
                    active_power: activePowerUnit,
                    active_energy: activeEnergyUnit,
                    reactive_power: reactivePowerUnit,
                    reactive_energy: reactiveEnergyUnit,
                    apparent_power: apparentPowerUnit,
                    apparent_energy: "kVAh",
                    power_factor: "dimensionless",
                },
                source_values: {
                    active_power: current.rawKw,
                    active_energy: current.rawKwh,
                    reactive_power: current.rawKvar,
                    reactive_energy: current.rawKvar,
                    apparent_power: current.rawKva,
                    power_factor: current.rawPf,
                    cumulative_register: current.rawCumulative,
                },
                normalised_units: CANONICAL_NORMALISED_UNITS,
                // Quality & Statutory Origin
                quality_status: qualityStatus,
                source_file_id: options?.sourceFileId || `src-${Date.now()}`,
                source_row_number: current.rowNumber,
                parser_version: "Stage10-v1.0",
                raw_payload: current.rawRow,
                // Backwards compatibility with Legacy Measurement interface
                ts: current.dateObj,
                kW: normKw,
                kVAr: normKvar,
                kVA: normKva,
                pf: normPf,
                tou: touPeriod,
                active_energy_kwh: normKwh,
                reactive_energy_kvarh: normKvarh,
                apparent_power_kva: normKva,
                active_power_kw: normKw,
            };
            records.push(record);
            // Step 10: Gap Detection (between current and next row)
            if (i < rawParsedRows.length - 1) {
                const nextTime = rawParsedRows[i + 1].dateObj.getTime();
                const currTime = current.dateObj.getTime();
                const diffMs = nextTime - currTime;
                if (diffMs > intervalMs + 1000) {
                    const missingIntervals = Math.floor(diffMs / intervalMs) - 1;
                    if (missingIntervals > 0) {
                        const gapStartUtc = new Date(currTime + intervalMs).toISOString();
                        const gapEndUtc = new Date(nextTime - intervalMs).toISOString();
                        const missingDurationMinutes = missingIntervals * detectedDurationMinutes;
                        const qualityImpact = missingDurationMinutes <= 120
                            ? "LOW"
                            : missingDurationMinutes <= 720
                                ? "MEDIUM"
                                : "HIGH";
                        const estimationPermitted = missingDurationMinutes <= 120; // 2 hour max estimation window
                        gapEvents.push({
                            meterId: detectedMeterId,
                            gapStartUtc,
                            gapEndUtc,
                            missingIntervals,
                            estimationPermitted,
                            resolutionStatus: estimationPermitted ? "estimated" : "open",
                            startLocal: current.localTs,
                            endLocal: rawParsedRows[i + 1].localTs,
                            missingCount: missingIntervals,
                        });
                        for (let step = 1; step <= missingIntervals; step++) {
                            const missingTimeMs = currTime + step * intervalMs;
                            const missingDate = new Date(missingTimeMs);
                            const sastMs = missingTimeMs + 2 * 3600 * 1000;
                            const sastDate = new Date(sastMs);
                            const expLocal = sastDate.toISOString().replace("T", " ").substring(0, 19);
                            missingIntervalDetails.push({
                                expectedLocalTimestamp: expLocal,
                                expectedUtcTimestamp: missingDate.toISOString(),
                                meterId: detectedMeterId,
                            });
                        }
                        missingGapRecords.push({
                            id: `gap-${Date.now()}-${i}`,
                            meter_id: detectedMeterId,
                            expected_interval: gapStartUtc,
                            received_interval: gapEndUtc,
                            missing_duration_minutes: missingDurationMinutes,
                            quality_impact: qualityImpact,
                            estimation_permitted: estimationPermitted,
                            suggested_method: "LINEAR_INTERPOLATION",
                            status: estimationPermitted ? "ESTIMATED" : "OPEN",
                        });
                        // If estimation requested and permitted, interpolate short gaps
                        if (options?.allowEstimation && estimationPermitted) {
                            const nextKw = rawParsedRows[i + 1].rawKw ?? 0;
                            for (let step = 1; step <= missingIntervals; step++) {
                                estimatedCount++;
                                const estTimeMs = currTime + step * intervalMs;
                                const estDate = new Date(estTimeMs);
                                const sastDate = new Date(estTimeMs + 2 * 3600 * 1000);
                                const ratio = step / (missingIntervals + 1);
                                const interpKw = Number((activePowerKw + (nextKw - activePowerKw) * ratio).toFixed(2));
                                const estKwh = Number((interpKw * (detectedDurationMinutes / 60)).toFixed(4));
                                const estLocalTs = sastDate.toISOString().replace("T", " ").substring(0, 19);
                                const estTouPeriod = classifyTou(estDate);
                                let estPeakKwh = 0;
                                let estStandardKwh = 0;
                                let estOffPeakKwh = 0;
                                if (estTouPeriod === "peak") {
                                    estPeakKwh = estKwh;
                                }
                                else if (estTouPeriod === "standard") {
                                    estStandardKwh = estKwh;
                                }
                                else {
                                    estOffPeakKwh = estKwh;
                                }
                                const estKva = Number((interpKw * 1.04).toFixed(4));
                                const estKvah = Number((estKva * (detectedDurationMinutes / 60)).toFixed(4));
                                const estKvar = Number((reactivePowerKvar * ratio).toFixed(4));
                                const estKvarh = Number((reactiveKvarh * ratio).toFixed(4));
                                records.push({
                                    // Identity & Cadence
                                    timestamp: estDate.toISOString(),
                                    timestamp_utc: estDate.toISOString(),
                                    local_timestamp: estLocalTs,
                                    timezone: options?.defaultTimezone || "Africa/Johannesburg",
                                    source_timezone: options?.defaultTimezone || "Africa/Johannesburg",
                                    meter_id: detectedMeterId,
                                    site_id: options?.organisationId
                                        ? `${options.organisationId}-${detectedMeterId}`
                                        : `site-${detectedMeterId}`,
                                    interval_minutes: detectedDurationMinutes,
                                    interval_duration_minutes: detectedDurationMinutes,
                                    // Normalised Energy
                                    kwh: estKwh,
                                    kvah: estKvah,
                                    peak_kwh: estPeakKwh,
                                    standard_kwh: estStandardKwh,
                                    off_peak_kwh: estOffPeakKwh,
                                    kvarh: estKvarh,
                                    // Normalised Power Demand
                                    kw: interpKw,
                                    kva: estKva,
                                    kvar: estKvar,
                                    // Power Quality
                                    power_factor: 0.96,
                                    // Classification
                                    tou_period: estTouPeriod,
                                    // Explicit Unit Metadata & Lineage
                                    source_units: {
                                        active_power: "kW",
                                        active_energy: "kWh",
                                        reactive_power: "kvar",
                                        reactive_energy: "kvarh",
                                        apparent_power: "kVA",
                                        apparent_energy: "kVAh",
                                        power_factor: "dimensionless",
                                    },
                                    source_values: {
                                        active_power: interpKw,
                                        active_energy: estKwh,
                                    },
                                    normalised_units: CANONICAL_NORMALISED_UNITS,
                                    // Quality & Statutory Origin
                                    quality_status: "estimated",
                                    source_file_id: options?.sourceFileId || `src-${Date.now()}`,
                                    source_row_number: current.rowNumber,
                                    parser_version: "Stage10-v1.0",
                                    // Backwards compatibility with Legacy Measurement interface
                                    ts: estDate,
                                    kW: interpKw,
                                    kVAr: estKvar,
                                    kVA: estKva,
                                    pf: 0.96,
                                    tou: estTouPeriod,
                                    active_energy_kwh: estKwh,
                                    reactive_energy_kvarh: estKvarh,
                                    apparent_power_kva: estKva,
                                    active_power_kw: interpKw,
                                });
                            }
                        }
                    }
                }
            }
        }
        if (duplicateCount > 0) {
            warnings.push(`DUPLICATES_DETECTED: Found ${duplicateCount} duplicate timestamp records in stream.`);
        }
        // Step 13: Processing Summary
        const totalMissingIntervals = gapEvents.reduce((acc, g) => acc + g.missingIntervals, 0);
        const totalActiveEnergyKwh = records.reduce((sum, r) => sum + r.active_energy_kwh, 0);
        const totalReactiveEnergyKvarh = records.reduce((sum, r) => sum + r.reactive_energy_kvarh, 0);
        const peakDemandKw = records.reduce((max, r) => Math.max(max, r.active_power_kw), 0);
        const peakDemandKva = records.reduce((max, r) => Math.max(max, r.apparent_power_kva), 0);
        const avgPowerFactor = records.length > 0
            ? Number((records.reduce((sum, r) => sum + (r.power_factor || 0.96), 0) / records.length).toFixed(4))
            : 0.96;
        // Quality Score: 100 - penalties
        let qualityScore = 100;
        if (records.length > 0) {
            const duplicatePenalty = Math.min(20, (duplicateCount / records.length) * 100);
            const suspectPenalty = Math.min(30, (suspectCount / records.length) * 100);
            const gapPenalty = Math.min(30, (totalMissingIntervals / (records.length + totalMissingIntervals)) * 100);
            qualityScore = Math.max(0, Math.round(100 - (duplicatePenalty + suspectPenalty + gapPenalty)));
        }
        const validationStatus = errors.length > 0
            ? "FAILED"
            : suspectCount > 0 || totalMissingIntervals > 0 || duplicateCount > 0
                ? "PARTIALLY_PROCESSED"
                : "VALID";
        const startUtc = records[0].timestamp_utc;
        const endUtc = records[records.length - 1].timestamp_utc;
        const durationDays = Math.max(1, Math.ceil((new Date(endUtc).getTime() - new Date(startUtc).getTime()) / (86400 * 1000)));
        const validCount = records.filter((r) => r.quality_status === "measured" || r.quality_status === "validated").length;
        const summary = {
            meterId: detectedMeterId,
            fileStructure,
            headers: detectedHeaders,
            detectedDurationMinutes,
            intervals: {
                total: records.length,
                totalParsed: rawParsedRows.length,
                valid: validCount,
                validMeasured: records.filter((r) => r.quality_status === "measured").length,
                estimated: estimatedCount,
                duplicates: duplicateCount,
                suspect: suspectCount,
                rollovers: rolloverCount,
            },
            timeRange: {
                startUtc,
                endUtc,
                startLocal: records[0].local_timestamp,
                endLocal: records[records.length - 1].local_timestamp,
                durationDays,
            },
            gaps: {
                gapCount: gapEvents.length,
                totalMissingIntervals,
                missingIntervalsTotal: totalMissingIntervals,
                gapEvents,
                missingIntervals: missingIntervalDetails,
            },
            totals: {
                totalActiveEnergyKwh: Number(totalActiveEnergyKwh.toFixed(2)),
                totalReactiveEnergyKvarh: Number(totalReactiveEnergyKvarh.toFixed(2)),
                peakDemandKw: Number(peakDemandKw.toFixed(2)),
                peakDemandKva: Number(peakDemandKva.toFixed(2)),
                averagePowerFactor: avgPowerFactor,
            },
            qualityScore,
            dataQualityScore: qualityScore,
            validationStatus,
            validationErrors: errors,
            validationWarnings: warnings,
            schemaType,
        };
        return {
            success: true,
            intervals: records,
            summary,
            errors,
            warnings,
        };
    }
    /**
     * Detects delimiter, parses spreadsheet sheets or text lines, and locates the header row
     */
    static detectStructureAndParseRows(filename, contentOrBuffer) {
        const isBinaryExcel = filename.endsWith(".xlsx") ||
            filename.endsWith(".xls") ||
            (contentOrBuffer instanceof Uint8Array && this.isZipOrOfl(contentOrBuffer)) ||
            (contentOrBuffer instanceof ArrayBuffer && this.isZipOrOfl(new Uint8Array(contentOrBuffer)));
        if (isBinaryExcel) {
            try {
                const wb = XLSX.read(contentOrBuffer, { type: "buffer", cellDates: true });
                // Find target sheet containing interval telemetry
                let targetSheetName = wb.SheetNames[0];
                let rawMatrix = [];
                for (const sName of wb.SheetNames) {
                    const sheet = wb.Sheets[sName];
                    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
                    const hasTelemetry = matrix.some((row) => {
                        const rowStr = row.map((c) => String(c).toLowerCase()).join(" ");
                        const hasTime = rowStr.includes("date") || rowStr.includes("time") || rowStr.includes("timestamp");
                        const hasMetric = rowStr.includes("kw") ||
                            rowStr.includes("kwh") ||
                            rowStr.includes("kvar") ||
                            rowStr.includes("kva") ||
                            rowStr.includes("power") ||
                            rowStr.includes("energy") ||
                            rowStr.includes("meter") ||
                            rowStr.includes("dial");
                        return hasTime && hasMetric;
                    });
                    if (hasTelemetry) {
                        targetSheetName = sName;
                        rawMatrix = matrix;
                        break;
                    }
                }
                if (!rawMatrix || rawMatrix.length === 0) {
                    targetSheetName = wb.SheetNames[0];
                    const sheet = wb.Sheets[targetSheetName];
                    rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
                }
                if (!rawMatrix || rawMatrix.length === 0) {
                    return {
                        fileStructure: {
                            delimiter: "EXCEL",
                            encoding: "UTF-8",
                            sheetName: targetSheetName,
                            sheetNames: wb.SheetNames,
                            headerRowIndex: 0,
                            preambleRowCount: 0,
                            totalRows: 0,
                            dataRows: 0,
                            preambleLines: [],
                        },
                        headerRow: [],
                        dataRows: [],
                        error: "EMPTY_EXCEL_SHEET: The selected Excel workbook sheet contains no rows.",
                    };
                }
                // Find header row past preamble
                let headerRowIndex = 0;
                const preambleLines = [];
                for (let i = 0; i < Math.min(25, rawMatrix.length); i++) {
                    const rowStrings = rawMatrix[i].map((c) => String(c).trim().toLowerCase());
                    const hasTime = rowStrings.some((c) => c.includes("date") || c.includes("time") || c.includes("timestamp"));
                    const hasMetric = rowStrings.some((c) => c.includes("kw") ||
                        c.includes("kwh") ||
                        c.includes("kvar") ||
                        c.includes("kva") ||
                        c.includes("power") ||
                        c.includes("energy") ||
                        c.includes("meter") ||
                        c.includes("dial"));
                    if (hasTime && hasMetric) {
                        headerRowIndex = i;
                        break;
                    }
                    if (rawMatrix[i].some((c) => Boolean(c))) {
                        preambleLines.push(rawMatrix[i].filter(Boolean).join(" | "));
                    }
                }
                const headerRow = rawMatrix[headerRowIndex].map((h) => String(h).trim());
                const dataRows = [];
                for (let i = headerRowIndex + 1; i < rawMatrix.length; i++) {
                    const rowVals = rawMatrix[i];
                    if (!rowVals || rowVals.length === 0 || !rowVals.some((c) => c !== ""))
                        continue;
                    const rowObj = {};
                    for (let c = 0; c < headerRow.length; c++) {
                        rowObj[headerRow[c]] = rowVals[c];
                    }
                    dataRows.push(rowObj);
                }
                return {
                    fileStructure: {
                        delimiter: "EXCEL",
                        encoding: "UTF-8",
                        sheetName: targetSheetName,
                        sheetNames: wb.SheetNames,
                        headerRowIndex,
                        preambleRowCount: preambleLines.length,
                        totalRows: rawMatrix.length,
                        dataRows: dataRows.length,
                        preambleLines,
                    },
                    headerRow,
                    dataRows,
                };
            }
            catch (err) {
                return {
                    fileStructure: {
                        delimiter: "EXCEL",
                        encoding: "UTF-8",
                        headerRowIndex: 0,
                        preambleRowCount: 0,
                        totalRows: 0,
                        dataRows: 0,
                        preambleLines: [],
                    },
                    headerRow: [],
                    dataRows: [],
                    error: `EXCEL_PARSE_ERROR: ${err.message || "Failed to parse workbook"}`,
                };
            }
        }
        // CSV / Text Processing
        const text = typeof contentOrBuffer === "string"
            ? contentOrBuffer
            : new TextDecoder().decode(contentOrBuffer instanceof Uint8Array
                ? contentOrBuffer
                : new Uint8Array(contentOrBuffer));
        const allLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (allLines.length === 0) {
            return {
                fileStructure: {
                    delimiter: ",",
                    encoding: "UTF-8",
                    headerRowIndex: 0,
                    preambleRowCount: 0,
                    totalRows: 0,
                    dataRows: 0,
                    preambleLines: [],
                },
                headerRow: [],
                dataRows: [],
                error: "EMPTY_FILE: The uploaded file contains no text rows.",
            };
        }
        // Detect Delimiter: Comma, Semicolon, Tab, Pipe
        const candidates = [",", ";", "\t", "|"];
        let detectedDelimiter = ",";
        let maxCandidateScore = -1;
        for (const d of candidates) {
            let score = 0;
            for (let i = 0; i < Math.min(10, allLines.length); i++) {
                const count = (allLines[i].match(new RegExp(`\\${d}`, "g")) || []).length;
                if (count >= 1)
                    score += count;
            }
            if (score > maxCandidateScore) {
                maxCandidateScore = score;
                detectedDelimiter = d;
            }
        }
        // Find Header Row vs Preamble
        let headerRowIndex = 0;
        const preambleLines = [];
        for (let i = 0; i < Math.min(25, allLines.length); i++) {
            const lower = allLines[i].toLowerCase();
            const hasTime = lower.includes("date") ||
                lower.includes("time") ||
                lower.includes("timestamp") ||
                lower.includes("ts");
            const hasMetric = lower.includes("kw") ||
                lower.includes("kwh") ||
                lower.includes("kvar") ||
                lower.includes("kva") ||
                lower.includes("power") ||
                lower.includes("energy") ||
                lower.includes("meter") ||
                lower.includes("cumulative") ||
                lower.includes("dial");
            if (hasTime && hasMetric) {
                headerRowIndex = i;
                break;
            }
            if (allLines[i].includes(":") ||
                allLines[i].includes("=") ||
                allLines[i].split(detectedDelimiter).length <= 2) {
                preambleLines.push(allLines[i].trim());
            }
        }
        const headerLine = allLines[headerRowIndex];
        const headerRow = this.splitCsvLine(headerLine, detectedDelimiter).map((h) => h.trim().replace(/^["']|["']$/g, ""));
        const dataRows = [];
        for (let i = headerRowIndex + 1; i < allLines.length; i++) {
            const line = allLines[i].trim();
            if (!line)
                continue;
            const parts = this.splitCsvLine(line, detectedDelimiter).map((p) => p.trim().replace(/^["']|["']$/g, ""));
            const rowObj = {};
            for (let c = 0; c < headerRow.length; c++) {
                rowObj[headerRow[c]] = parts[c] !== undefined ? parts[c] : "";
            }
            dataRows.push(rowObj);
        }
        return {
            fileStructure: {
                delimiter: detectedDelimiter,
                encoding: "UTF-8",
                headerRowIndex,
                preambleRowCount: preambleLines.length,
                totalRows: allLines.length,
                dataRows: dataRows.length,
                preambleLines,
            },
            headerRow,
            dataRows,
        };
    }
    /**
     * Identifies timestamp, power, energy, reactive, and dial columns
     */
    static identifyColumns(headers, headerRowIndex = 0) {
        const rawHeaders = headers;
        const findCol = (candidates) => {
            // Pass 1: exact string equality (case-insensitive, non-alphanumeric stripped)
            for (const h of headers) {
                const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, "");
                for (const c of candidates) {
                    const cleanC = c.toLowerCase().replace(/[^a-z0-9]/g, "");
                    if (cleanH === cleanC)
                        return h;
                }
            }
            // Pass 2: token boundary match
            for (const h of headers) {
                const tokens = h
                    .toLowerCase()
                    .split(/[^a-z0-9]+/)
                    .filter(Boolean);
                for (const c of candidates) {
                    const cTokens = c
                        .toLowerCase()
                        .split(/[^a-z0-9]+/)
                        .filter(Boolean);
                    if (cTokens.length === 1 && tokens.includes(cTokens[0])) {
                        return h;
                    }
                    if (cTokens.length > 1 && cTokens.every((t) => tokens.includes(t))) {
                        return h;
                    }
                }
            }
            // Pass 3: substring match ONLY for longer multi-word phrases (len >= 6)
            for (const h of headers) {
                const lowerH = h.toLowerCase();
                for (const c of candidates) {
                    if (c.length >= 6 && lowerH.includes(c.toLowerCase())) {
                        return h;
                    }
                }
            }
            return undefined;
        };
        // 1. Check for Combined Timestamp Column first
        // Note: Do NOT match standalone "time" or "reading time" here if a separate date column might exist
        let timestampColumn = findCol([
            "datetime",
            "date & time",
            "date and time",
            "date/time",
            "reading datetime",
            "iso_timestamp",
            "timestamp",
            "ts",
        ]);
        // 2. Split Date & Time Columns
        let dateColumn;
        let timeColumn;
        if (!timestampColumn) {
            dateColumn = findCol(["reading date", "interval date", "date", "day"]);
            timeColumn = findCol(["reading time", "interval time", "time", "slot", "period"]);
            // If only one exists (e.g. only "reading time" without "date"), fallback to treating it as timestampColumn
            if (!dateColumn && timeColumn) {
                timestampColumn = timeColumn;
                timeColumn = undefined;
            }
        }
        // 3. Meter Column
        const meterColumn = findCol([
            "meter_serial_number",
            "meter serial number",
            "meter_id",
            "meter id",
            "meter_number",
            "meter number",
            "meter no",
            "meter serial",
            "device_id",
            "device id",
            "msn",
            "meter",
        ]);
        // 4. Active Power (kW Demand / MW Demand)
        const activePowerColumn = findCol([
            "active power (kw)",
            "active power (mw)",
            "active power import (kw)",
            "active power",
            "active kw",
            "demand (kw)",
            "kw demand",
            "kw import",
            "total kw",
            "import kw",
            "demand kw",
            "kw",
            "mw",
        ]);
        // 5. Active Energy (kWh / MWh)
        const activeEnergyColumn = findCol([
            "active energy (kwh)",
            "active energy",
            "active_power_kwh",
            "active power kwh",
            "active energy kwh",
            "active import kwh",
            "import kwh",
            "kwh imp",
            "energy (kwh)",
            "kwh import",
            "kwh",
            "mwh",
        ]);
        // 6. Reactive Energy / Power (kVAR / kVARh / MVAR)
        const reactiveEnergyColumn = findCol([
            "reactive power (kvar)",
            "reactive power (mvar)",
            "reactive energy (kvarh)",
            "reactive_power_kvarh",
            "reactive energy kvarh",
            "reactive power kvarh",
            "reactive power",
            "reactive energy",
            "kvarh imp",
            "kvar imp",
            "kvarh",
            "kvar",
            "mvarh",
            "mvar",
        ]);
        // 7. Apparent Power (kVA Demand)
        const apparentPowerColumn = findCol([
            "apparent power (kva)",
            "apparent power",
            "apparent_power_kva",
            "apparent power kva",
            "demand (kva)",
            "kva demand",
            "kva total",
            "kva imp",
            "kva",
        ]);
        // 8. Power Factor
        const powerFactorColumn = findCol(["power factor", "cos phi", "cosphi", "pf"]);
        // 9. Cumulative Register
        const cumulativeRegisterColumn = findCol([
            "cumulative active register (kwh)",
            "cumulative active register",
            "meter dial reading",
            "cumulative active",
            "cumulative kwh",
            "register reading",
            "meter dial",
            "reading (kwh)",
            "cumulative register",
            "dial reading",
            "cumulative",
            "index",
        ]);
        return {
            rawHeaders,
            headerRowIndex,
            timestampColumn,
            dateColumn,
            timeColumn,
            meterColumn,
            activePowerColumn,
            activeEnergyColumn,
            reactiveEnergyColumn,
            apparentPowerColumn,
            powerFactorColumn,
            cumulativeRegisterColumn,
        };
    }
    /**
     * Identifies meter ID from column, preamble, filename, or default
     */
    static identifyMeter(filename, preambleLines, headers, rows, configuredMeterId) {
        if (configuredMeterId)
            return configuredMeterId;
        // 1. Column in data
        if (headers.meterColumn && rows.length > 0) {
            const val = rows[0][headers.meterColumn];
            if (val)
                return String(val).trim();
        }
        // 2. Preamble search
        for (const line of preambleLines) {
            if (line.includes(":") || line.includes("=")) {
                const parts = line.split(/[:=]/);
                const label = parts[0].toLowerCase();
                const val = parts.slice(1).join(":").trim();
                if (label.includes("meter") ||
                    label.includes("device") ||
                    label.includes("serial") ||
                    label.includes("msn")) {
                    const matchVal = val.match(/([A-Za-z0-9_-]{4,})/);
                    if (matchVal)
                        return matchVal[1].trim();
                }
            }
        }
        // 3. Filename search
        const fnMeterMatch = filename.match(/(?:meter|mtr)[_\s-]*([A-Za-z0-9]+)/i);
        if (fnMeterMatch)
            return fnMeterMatch[1];
        const numMatch = filename.match(/(\d{6,12})/);
        if (numMatch)
            return numMatch[1];
        return "";
    }
    /**
     * Parses various timestamp expressions into a local SAST timestamp and UTC Date
     */
    static parseTimestamp(row, headers, _defaultTimezone = "Africa/Johannesburg") {
        let rawVal = undefined;
        if (headers.timestampColumn) {
            rawVal = row[headers.timestampColumn];
        }
        else if (headers.dateColumn && headers.timeColumn) {
            const d = String(row[headers.dateColumn] || "").trim();
            const t = String(row[headers.timeColumn] || "").trim();
            if (d && t)
                rawVal = `${d} ${t}`;
        }
        if (rawVal === undefined || rawVal === null || rawVal === "")
            return null;
        // Excel serial date number
        if (typeof rawVal === "number") {
            const totalDays = rawVal - 25569;
            const totalMs = Math.round(totalDays * 86400 * 1000);
            const utcDate = new Date(totalMs);
            if (isNaN(utcDate.getTime()))
                return null;
            const year = utcDate.getUTCFullYear();
            const month = utcDate.getUTCMonth() + 1;
            const day = utcDate.getUTCDate();
            const hours = utcDate.getUTCHours();
            const mins = utcDate.getUTCMinutes();
            const secs = utcDate.getUTCSeconds();
            const pad = (n) => String(n).padStart(2, "0");
            const localTs = `${year}-${pad(month)}-${pad(day)} ${pad(hours)}:${pad(mins)}:${pad(secs)}`;
            const isoUtc = new Date(Date.UTC(year, month - 1, day, hours - 2, mins, secs)).toISOString();
            const dateObj = new Date(isoUtc);
            return { dateObj, localTs, isoUtc };
        }
        if (rawVal instanceof Date) {
            const isoUtc = rawVal.toISOString();
            const localTs = rawVal.toISOString().replace("T", " ").substring(0, 19);
            return { dateObj: rawVal, localTs, isoUtc };
        }
        const rawStr = String(rawVal).trim().replace(/["']/g, "");
        if (!rawStr)
            return null;
        // Check if ISO with explicit timezone offset: e.g. "2026-02-01T00:00:00+02:00" or "...Z"
        const hasExplicitTz = /([+\-]\d{2}:?\d{2}|Z)$/i.test(rawStr);
        if (hasExplicitTz) {
            const parsed = new Date(rawStr);
            if (isNaN(parsed.getTime()))
                return null;
            const isoUtc = parsed.toISOString();
            const sastDate = new Date(parsed.getTime() + 2 * 3600 * 1000);
            const localTs = sastDate.toISOString().replace("T", " ").substring(0, 19);
            return { dateObj: parsed, localTs, isoUtc };
        }
        // Unzoned local timestamp (Standard Utility Export format in SAST)
        const clean = rawStr.replace(/\s+/, " ");
        let year = 2026;
        let month = 1;
        let day = 1;
        let timePart = "00:00:00";
        const ddmmyyyy = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(.*))?$/);
        const yyyymmdd = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[\sT]+(.*))?$/);
        if (ddmmyyyy) {
            day = parseInt(ddmmyyyy[1], 10);
            month = parseInt(ddmmyyyy[2], 10);
            year = parseInt(ddmmyyyy[3], 10);
            if (ddmmyyyy[4])
                timePart = ddmmyyyy[4].trim();
        }
        else if (yyyymmdd) {
            year = parseInt(yyyymmdd[1], 10);
            month = parseInt(yyyymmdd[2], 10);
            day = parseInt(yyyymmdd[3], 10);
            if (yyyymmdd[4])
                timePart = yyyymmdd[4].trim();
        }
        else {
            const fallback = new Date(clean.replace(/\//g, "-").replace(/\s+/, "T"));
            if (isNaN(fallback.getTime()))
                return null;
            const localTs = fallback.toISOString().replace("T", " ").substring(0, 19);
            return { dateObj: fallback, localTs, isoUtc: fallback.toISOString() };
        }
        const timeMatch = timePart.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
        const hours = timeMatch ? parseInt(timeMatch[1], 10) : 0;
        const mins = timeMatch ? parseInt(timeMatch[2], 10) : 0;
        const secs = timeMatch && timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
        const pad = (n) => String(n).padStart(2, "0");
        const localTs = `${year}-${pad(month)}-${pad(day)} ${pad(hours)}:${pad(mins)}:${pad(secs)}`;
        // Normalise to UTC assuming SAST (UTC+2)
        const utcDate = new Date(Date.UTC(year, month - 1, day, hours - 2, mins, secs));
        if (isNaN(utcDate.getTime()))
            return null;
        const isoUtc = utcDate.toISOString();
        return {
            dateObj: utcDate,
            localTs,
            isoUtc,
        };
    }
    /**
     * Detects interval duration in minutes (5, 15, 30, or 60)
     */
    static detectIntervalDuration(timestamps) {
        if (timestamps.length < 2)
            return 30;
        const diffs = [];
        for (let i = 0; i < Math.min(50, timestamps.length - 1); i++) {
            const diffMs = timestamps[i + 1].getTime() - timestamps[i].getTime();
            if (diffMs > 0 && diffMs <= 120 * 60 * 1000) {
                diffs.push(Math.round(diffMs / 60000));
            }
        }
        if (diffs.length === 0)
            return 30;
        const counts = {};
        for (const d of diffs) {
            counts[d] = (counts[d] || 0) + 1;
        }
        let modeMinutes = 30;
        let maxCount = 0;
        for (const [m, c] of Object.entries(counts)) {
            if (c > maxCount) {
                maxCount = c;
                modeMinutes = Number(m);
            }
        }
        if (modeMinutes <= 8)
            return 5;
        if (modeMinutes <= 20)
            return 15;
        if (modeMinutes <= 45)
            return 30;
        return 60;
    }
    /**
     * Classifies the schema structure
     */
    static classifySchema(headers, duration, rows) {
        if (headers.cumulativeRegisterColumn || rows.some((r) => r.rawCumulative !== undefined)) {
            return "CUMULATIVE_REGISTERS";
        }
        if (headers.activeEnergyColumn && !headers.activePowerColumn) {
            return "ENERGY_ONLY_KWH";
        }
        if (duration === 15) {
            return "MUNICIPAL_15MIN";
        }
        if (headers.activePowerColumn &&
            (headers.apparentPowerColumn || headers.reactiveEnergyColumn)) {
            return "ESKOM_AMR_30M";
        }
        return "GENERIC_INTERVAL";
    }
    /**
     * Helper to parse string number with negative parenthetical and symbol cleaning
     */
    static parseNumber(val) {
        if (val === undefined || val === null || val === "")
            return undefined;
        if (typeof val === "number")
            return isNaN(val) ? undefined : val;
        const str = String(val).trim();
        if (!str)
            return undefined;
        const isNeg = str.includes("(") || str.startsWith("-");
        const cleaned = str.replace(/[^0-9.]/g, "");
        const num = parseFloat(cleaned);
        if (isNaN(num))
            return undefined;
        return isNeg ? -num : num;
    }
    /**
     * Splits a CSV line with respect to quotes
     */
    static splitCsvLine(line, delimiter) {
        const regex = new RegExp(`(?:^|\\${delimiter})(?:"([^"]*)"|([^"${delimiter}]*))`, "g");
        const result = [];
        let match;
        while ((match = regex.exec(line)) !== null) {
            result.push(match[1] !== undefined ? match[1] : match[2]);
        }
        return result.length > 0 ? result : line.split(delimiter);
    }
    /**
     * Inspects binary buffer for Zip (xlsx) or OLE (xls) magic bytes
     */
    static isZipOrOfl(bytes) {
        if (bytes.length < 4)
            return false;
        // PK\x03\x04 (Zip / xlsx)
        if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)
            return true;
        // D0 CF 11 E0 (OLE / xls)
        if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0)
            return true;
        return false;
    }
    /**
     * Generates failure result for uninterpretable files
     */
    static createFailureResult(filename, structure, errors, warnings, headers) {
        const emptyHeaders = headers || {
            rawHeaders: structure.headerRow || [],
        };
        const emptyStructure = structure.fileStructure || {
            delimiter: ",",
            encoding: "UTF-8",
            headerRowIndex: 0,
            preambleRowCount: 0,
            totalRows: 0,
            dataRows: 0,
            preambleLines: [],
        };
        const summary = {
            meterId: "UNKNOWN",
            fileStructure: emptyStructure,
            headers: emptyHeaders,
            detectedDurationMinutes: 30,
            intervals: {
                total: 0,
                totalParsed: 0,
                valid: 0,
                validMeasured: 0,
                estimated: 0,
                duplicates: 0,
                suspect: 0,
                rollovers: 0,
            },
            timeRange: {
                startUtc: new Date().toISOString(),
                endUtc: new Date().toISOString(),
                startLocal: "",
                endLocal: "",
                durationDays: 0,
            },
            gaps: {
                gapCount: 0,
                totalMissingIntervals: 0,
                missingIntervalsTotal: 0,
                gapEvents: [],
                missingIntervals: [],
            },
            totals: {
                totalActiveEnergyKwh: 0,
                totalReactiveEnergyKvarh: 0,
                peakDemandKw: 0,
                peakDemandKva: 0,
                averagePowerFactor: 0.96,
            },
            qualityScore: 0.0,
            dataQualityScore: 0.0,
            validationStatus: "FAILED",
            validationErrors: errors,
            validationWarnings: warnings,
            schemaType: "GENERIC_INTERVAL",
        };
        return {
            success: false,
            intervals: [],
            summary,
            errors,
            warnings,
        };
    }
}
