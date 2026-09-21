/**
 * Stage 10 — Energy Data Normalisation Engine
 *
 * Implements authoritative mathematical normalisation, unit scaling, and
 * non-destructive derivation of electrical quantities without silent unit mixing:
 *
 * 1. Explicit separation of Instantaneous Power (kW, kVA, kvar) and Interval Energy (kWh, kVAh, kvarh).
 * 2. Strict unit scaling for metric prefixes (W, kW, MW, Wh, kWh, MWh, VAR, kvar, MVAR, etc.).
 * 3. Exact cadence integration: Energy = Power * (interval_minutes / 60)
 * 4. Vector triangle apparent and power factor derivations:
 *      kVA  = sqrt(kW^2 + kvar^2)
 *      kVAh = sqrt(kWh^2 + kvarh^2)
 *      PF   = kW / kVA = kWh / kVAh
 * 5. NERSA Time-Of-Use (TOU) energy decomposition:
 *      kwh = peak_kwh + standard_kwh + off_peak_kwh
 * 6. Full source & normalised unit audit lineage.
 */
import { classifyTou } from "@/lib/tariff";
import { CANONICAL_NORMALISED_UNITS, } from "./canonicalEnergyRecord";
export class EnergyDataNormalizationEngine {
    /**
     * Multipliers to convert power units to standard kW
     */
    static POWER_TO_KW_MULTIPLIER = {
        W: 0.001,
        kW: 1.0,
        KW: 1.0,
        MW: 1000.0,
        VA: 0.001,
        kVA: 1.0,
        KVA: 1.0,
        MVA: 1000.0,
        VAR: 0.001,
        kvar: 1.0,
        kVAR: 1.0,
        MVAR: 1000.0,
    };
    /**
     * Multipliers to convert energy units to standard kWh
     */
    static ENERGY_TO_KWH_MULTIPLIER = {
        Wh: 0.001,
        WH: 0.001,
        kWh: 1.0,
        KWH: 1.0,
        MWh: 1000.0,
        MWH: 1000.0,
        VAh: 0.001,
        kVAh: 1.0,
        MVAh: 1000.0,
        VARh: 0.001,
        kvarh: 1.0,
        kVARh: 1.0,
        MVARh: 1000.0,
    };
    /**
     * Normalizes a single raw interval reading into a canonical energy record
     */
    static normalizeInterval(input, options) {
        const intervalMinutes = input.interval_minutes || options?.defaultIntervalMinutes || 30;
        const hours = intervalMinutes / 60;
        const meterId = input.meter_id || options?.defaultMeterId || "UNASSIGNED_METER";
        const siteId = input.site_id || options?.defaultSiteId || `site-${meterId}`;
        const tz = input.timezone || options?.defaultTimezone || "Africa/Johannesburg";
        // 1. Resolve Timestamp & SAST Local Representation
        const dateObj = input.timestamp instanceof Date ? input.timestamp : new Date(input.timestamp);
        if (isNaN(dateObj.getTime())) {
            throw new Error(`INVALID_TIMESTAMP: Unparseable date/time value: ${String(input.timestamp)}`);
        }
        const isoUtc = dateObj.toISOString();
        // Calculate SAST local time (+02:00)
        const sastTimeMs = dateObj.getTime() + 2 * 3600 * 1000;
        const sastDate = new Date(sastTimeMs);
        const localTs = sastDate.toISOString().replace("T", " ").substring(0, 19);
        // 2. Capture Source Values
        const sourceUnits = {
            active_power: input.source_units?.active_power || "kW",
            active_energy: input.source_units?.active_energy || "kWh",
            reactive_power: input.source_units?.reactive_power || "kvar",
            reactive_energy: input.source_units?.reactive_energy || "kvarh",
            apparent_power: input.source_units?.apparent_power || "kVA",
            apparent_energy: input.source_units?.apparent_energy || "kVAh",
            power_factor: "dimensionless",
        };
        const sourceValues = {
            active_power: input.raw_active_power,
            active_energy: input.raw_active_energy,
            reactive_power: input.raw_reactive_power,
            reactive_energy: input.raw_reactive_energy,
            apparent_power: input.raw_apparent_power,
            apparent_energy: input.raw_apparent_energy,
            power_factor: input.raw_power_factor,
            cumulative_register: input.raw_cumulative_register,
        };
        const derivedFields = [];
        const formulasApplied = {};
        const multipliers = {};
        // 3. Normalise Active Power (kW) & Active Energy (kWh)
        let kw;
        let kwh;
        if (input.raw_active_power !== undefined && !isNaN(input.raw_active_power)) {
            const mult = this.POWER_TO_KW_MULTIPLIER[sourceUnits.active_power || "kW"] || 1.0;
            kw = input.raw_active_power * mult;
            multipliers.active_power = mult;
        }
        if (input.raw_active_energy !== undefined && !isNaN(input.raw_active_energy)) {
            const mult = this.ENERGY_TO_KWH_MULTIPLIER[sourceUnits.active_energy || "kWh"] || 1.0;
            kwh = input.raw_active_energy * mult;
            multipliers.active_energy = mult;
        }
        // Explicit Cadence Integration without silent mixing
        if (kwh === undefined && kw !== undefined) {
            kwh = kw * hours;
            derivedFields.push("kwh");
            formulasApplied.kwh = `kw * (${intervalMinutes} / 60)`;
        }
        else if (kw === undefined && kwh !== undefined) {
            kw = kwh / hours;
            derivedFields.push("kw");
            formulasApplied.kw = `kwh / (${intervalMinutes} / 60)`;
        }
        else if (kw === undefined && kwh === undefined) {
            kw = 0;
            kwh = 0;
        }
        // 4. Normalise Reactive Power (kvar) & Reactive Energy (kvarh)
        let kvar;
        let kvarh;
        if (input.raw_reactive_power !== undefined && !isNaN(input.raw_reactive_power)) {
            const mult = this.POWER_TO_KW_MULTIPLIER[sourceUnits.reactive_power || "kvar"] || 1.0;
            kvar = input.raw_reactive_power * mult;
            multipliers.reactive_power = mult;
        }
        if (input.raw_reactive_energy !== undefined && !isNaN(input.raw_reactive_energy)) {
            const mult = this.ENERGY_TO_KWH_MULTIPLIER[sourceUnits.reactive_energy || "kvarh"] || 1.0;
            kvarh = input.raw_reactive_energy * mult;
            multipliers.reactive_energy = mult;
        }
        if (kvarh === undefined && kvar !== undefined) {
            kvarh = kvar * hours;
            derivedFields.push("kvarh");
            formulasApplied.kvarh = `kvar * (${intervalMinutes} / 60)`;
        }
        else if (kvar === undefined && kvarh !== undefined) {
            kvar = kvarh / hours;
            derivedFields.push("kvar");
            formulasApplied.kvar = `kvarh / (${intervalMinutes} / 60)`;
        }
        else if (kvar === undefined && kvarh === undefined) {
            kvar = 0;
            kvarh = 0;
        }
        // 5. Normalise Apparent Power (kVA) & Apparent Energy (kVAh)
        let kva;
        let kvah;
        if (input.raw_apparent_power !== undefined && !isNaN(input.raw_apparent_power)) {
            const mult = this.POWER_TO_KW_MULTIPLIER[sourceUnits.apparent_power || "kVA"] || 1.0;
            kva = input.raw_apparent_power * mult;
            multipliers.apparent_power = mult;
        }
        if (input.raw_apparent_energy !== undefined && !isNaN(input.raw_apparent_energy)) {
            const mult = this.ENERGY_TO_KWH_MULTIPLIER[sourceUnits.apparent_energy || "kVAh"] || 1.0;
            kvah = input.raw_apparent_energy * mult;
            multipliers.apparent_energy = mult;
        }
        // Mathematical Derivation of Apparent quantities if missing:
        // kVA = sqrt(kW^2 + kvar^2)
        if (kva === undefined) {
            if (kw !== undefined && kvar !== undefined && (kw > 0 || kvar > 0)) {
                kva = Math.sqrt(kw * kw + kvar * kvar);
                derivedFields.push("kva");
                formulasApplied.kva = "sqrt(kw^2 + kvar^2)";
            }
            else if (kw !== undefined && input.raw_power_factor && input.raw_power_factor > 0) {
                kva = kw / input.raw_power_factor;
                derivedFields.push("kva");
                formulasApplied.kva = "kw / power_factor";
            }
            else {
                kva = kw || 0;
            }
        }
        if (kvah === undefined) {
            if (kva !== undefined && kva > 0) {
                kvah = kva * hours;
                derivedFields.push("kvah");
                formulasApplied.kvah = `kva * (${intervalMinutes} / 60)`;
            }
            else if (kwh !== undefined && kvarh !== undefined && (kwh > 0 || kvarh > 0)) {
                kvah = Math.sqrt(kwh * kwh + kvarh * kvarh);
                derivedFields.push("kvah");
                formulasApplied.kvah = "sqrt(kwh^2 + kvarh^2)";
            }
            else {
                kvah = kwh || 0;
            }
        }
        // 6. Normalise Power Factor [-1.0, 1.0]
        let pf = input.raw_power_factor;
        if (pf === undefined || isNaN(pf)) {
            if (kva && kva > 0 && kw !== undefined) {
                pf = Math.min(1.0, Math.max(0.0, kw / kva));
                derivedFields.push("power_factor");
                formulasApplied.power_factor = "kw / kva";
            }
            else if (kvah && kvah > 0 && kwh !== undefined) {
                pf = Math.min(1.0, Math.max(0.0, kwh / kvah));
                derivedFields.push("power_factor");
                formulasApplied.power_factor = "kwh / kvah";
            }
            else {
                pf = 1.0;
            }
        }
        else {
            // Clamp power factor to valid mathematical boundaries
            pf = Math.min(1.0, Math.max(-1.0, pf));
        }
        // Physical Boundary Integrity: Active Power cannot exceed Apparent Power
        if (kw !== undefined && kva !== undefined && kw > kva + 0.01) {
            kva = Math.sqrt(kw * kw + (kvar || 0) * (kvar || 0));
            kvah = kva * hours;
            derivedFields.push("kva_realigned");
            formulasApplied.kva_realigned =
                "Realignment: kw exceeded kVA, recomputed from sqrt(kw^2 + kvar^2)";
        }
        // Round normalised quantities to 4 decimal precision
        const normKw = Number((kw || 0).toFixed(4));
        const normKwh = Number((kwh || 0).toFixed(4));
        const normKva = Number((kva || 0).toFixed(4));
        const normKvah = Number((kvah || 0).toFixed(4));
        const normKvar = Number((kvar || 0).toFixed(4));
        const normKvarh = Number((kvarh || 0).toFixed(4));
        const normPf = Number((pf || 1.0).toFixed(4));
        // 7. Time-Of-Use Decomposition (Peak, Standard, Off-Peak)
        const touPeriod = classifyTou(dateObj);
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
        const conversionAudit = {
            active_power_multiplier: multipliers.active_power,
            active_energy_multiplier: multipliers.active_energy,
            reactive_power_multiplier: multipliers.reactive_power,
            reactive_energy_multiplier: multipliers.reactive_energy,
            apparent_power_multiplier: multipliers.apparent_power,
            apparent_energy_multiplier: multipliers.apparent_energy,
            derived_fields: derivedFields,
            formulas_applied: formulasApplied,
        };
        return {
            timestamp: isoUtc,
            timestamp_utc: isoUtc,
            local_timestamp: localTs,
            timezone: tz,
            source_timezone: tz,
            meter_id: meterId,
            site_id: siteId,
            interval_minutes: intervalMinutes,
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
            // Unit & Audit Lineage
            source_units: sourceUnits,
            source_values: sourceValues,
            normalised_units: CANONICAL_NORMALISED_UNITS,
            conversion_multipliers: multipliers,
            conversion_audit: conversionAudit,
            // Operational state
            quality_status: input.quality_status || "measured",
            source_file_id: input.source_file_id || `src-${Date.now()}`,
            source_row_number: input.source_row_number || 1,
            parser_version: "Stage10-v1.0",
            raw_payload: input.raw_payload,
            // Backwards Compatibility properties for legacy Measurement consumers
            ts: dateObj,
            kW: normKw,
            kVAr: normKvar,
            kVA: normKva,
            pf: normPf,
            tou: touPeriod,
            active_energy_kwh: normKwh,
            reactive_energy_kvarh: normKvarh,
            apparent_power_kva: normKva,
            active_power_kw: normKw,
            interval_duration_minutes: intervalMinutes,
        };
    }
    /**
     * Normalizes a batch of interval records ensuring consistent schema and time progression
     */
    static normalizeBatch(inputs, options) {
        return inputs.map((inp, idx) => this.normalizeInterval({
            ...inp,
            source_row_number: inp.source_row_number || idx + 1,
        }, options));
    }
    /**
     * Bridges a CanonicalTelemetryRecord to a full Stage 10 CanonicalEnergyRecord
     */
    static fromCanonicalTelemetryRecord(rec, siteId) {
        const rawUnits = {
            active_power: "kW",
            active_energy: "kWh",
            reactive_power: "kvar",
            reactive_energy: "kvarh",
            apparent_power: "kVA",
            apparent_energy: "kVAh",
            power_factor: "dimensionless",
        };
        return this.normalizeInterval({
            timestamp: rec.timestamp_utc,
            meter_id: rec.meter_id,
            site_id: siteId || `site-${rec.meter_id}`,
            interval_minutes: rec.interval_minutes || 30,
            timezone: rec.timezone || "Africa/Johannesburg",
            source_units: rawUnits,
            raw_active_power: rec.active_power_kw,
            raw_active_energy: rec.active_energy_kwh,
            raw_reactive_energy: rec.reactive_energy_kvarh,
            raw_apparent_power: rec.apparent_power_kva,
            raw_power_factor: rec.power_factor,
            quality_status: rec.quality_status,
            source_file_id: rec.source_file_id,
            source_row_number: rec.source_row_number,
            raw_payload: rec.raw_payload,
        });
    }
}
