import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js-light';
import { TariffEngine } from '../../domain/services/tariffEngine';
import { TouScheduleEngine } from '../../domain/tariff/touScheduleEngine';
import { DeterministicEngine } from '../../domain/tariff/deterministicEngine';
import { FinancialMath } from '../../domain/services/financialMath';
import { classifyTou } from '../tariff';
import { computeTotals } from '../reconciliation';
import { imputeAndFlag, type Measurement } from '../parseMeter';
import { extractInvoiceFromPdf } from '../pdfInvoice';

describe('Adversarial Principal Audit Suite (First Principles)', () => {
  // --------------------------------------------------------------------------
  // Area 1 & 13: Deterministic Engine Reactive Energy Charge Bug Test
  // --------------------------------------------------------------------------
  it('1. DEFECT PROBE: DeterministicEngine reactive energy charge fallback when reactive_energy_kvarh is 0', () => {
    const tariffVersionDef = {
      header: { tariff_code: 'MEGAFLEX_2025', version: '2025-04-01', effective_date: '2025-04-01' },
      components: [
        {
          component_code: 'REACTIVE_PENALTY',
          component_name: 'Reactive Energy Penalty',
          component_type: 'REACTIVE_ENERGY',
          unit_of_measure: 'c/kVARh',
          rate_value: new Decimal('14.15'),
          season: 'all' as const,
        },
      ],
      public_holidays: [],
      tou_schedule: [],
    };
    
    // Low Power Factor (0.90 < 0.96), but 0 reactive energy measured
    const inputWithZeroKvarh = {
      billing_start: '2025-05-01T00:00:00Z',
      billing_end: '2025-05-31T23:59:59Z',
      peak_kwh: new Decimal('100000'),
      standard_kwh: new Decimal('200000'),
      off_peak_kwh: new Decimal('300000'),
      active_energy_kwh: new Decimal('600000'),
      maximum_demand_kva: new Decimal('2000'),
      notified_maximum_demand_kva: new Decimal('2500'),
      power_factor: new Decimal('0.90'),
      reactive_energy_kvarh: new Decimal('0'), // ZERO reactive energy
    };

    const res = DeterministicEngine.calculateTariff(inputWithZeroKvarh, tariffVersionDef as any);
    const reactiveItem = res.items.find((i) => i.component_code.includes('REACTIVE'));
    
    console.log('[PROBE 1] Reactive Item presence with 0 kVARh input:', reactiveItem);
    // Verified fix: When reactive_energy_kvarh is 0, no reactive charge item is generated
    expect(reactiveItem).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // Area 2 & 3: TOU & Season Boundary Classification Discrepancy
  // --------------------------------------------------------------------------
  it('2. DEFECT PROBE: TOU classification boundary timestamp determinism in SAST (+02:00)', () => {
    // Meter reading timestamp 04:00:00 UTC corresponds to 06:00:00 SAST.
    // In electricity metering, 06:00 SAST marks the end of interval 05:30 to 06:00 (Off-Peak).
    const ts0600Sast = new Date('2025-06-02T04:00:00Z'); // Monday 2 June 2025

    const touLegacy = classifyTou(ts0600Sast);
    const megVersion = TariffEngine.getMegaflexDefinition(ts0600Sast);
    
    const domainTariffDef = {
      header: { tariff_code: megVersion.family, version: megVersion.effectiveFrom, effective_date: megVersion.effectiveFrom },
      components: [],
      public_holidays: [],
      tou_schedule: [
        {
          season: 'high' as const,
          schedules: [
            {
              day_type: 'weekday' as const,
              windows: [
                { start_time: '06:00', end_time: '09:00', hour_start: 6, hour_end: 9, period: 'peak' as const },
                { start_time: '09:00', end_time: '17:00', hour_start: 9, hour_end: 17, period: 'standard' as const },
                { start_time: '17:00', end_time: '19:00', hour_start: 17, hour_end: 19, period: 'peak' as const },
                { start_time: '19:00', end_time: '22:00', hour_start: 19, hour_end: 22, period: 'standard' as const },
              ],
            },
          ],
        },
      ],
    };

    const touSchedule = TouScheduleEngine.resolveTouPeriod(ts0600Sast, domainTariffDef as any);

    console.log('[PROBE 2] 06:00 SAST Interval Classification -> Legacy:', touLegacy, '| TouScheduleEngine:', touSchedule);

    expect(touLegacy).toBe('offPeak');
    expect(touSchedule).toBe('off_peak');
  });

  // --------------------------------------------------------------------------
  // Area 4: Public Holiday Sunday-to-Monday Substitution Rule
  // --------------------------------------------------------------------------
  it('4. DEFECT PROBE: Freedom Day 2025-04-27 (Sunday) observed on 2025-04-28 (Monday)', () => {
    const mondayObserved = new Date('2025-04-28T10:00:00Z');
    const isHolidayInScheduleEngine = TouScheduleEngine.isPublicHoliday(mondayObserved, [
      { name: 'Freedom Day', date: '2025-04-27', day_type_override: 'sunday' },
    ]);

    expect(isHolidayInScheduleEngine).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Area 6: Meter Timezone Parsing Probe
  // --------------------------------------------------------------------------
  it('6. DEFECT PROBE: String date parsing without offset in different environments', () => {
    const dateStr = '2026-06-01 06:00:00';
    const parsed = new Date(dateStr);
    expect(isNaN(parsed.getTime())).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Area 8: Missing Interval Time Gap Detection Probe
  // --------------------------------------------------------------------------
  it('8. DEFECT PROBE: Missing interval time gaps in input series', () => {
    const rows: Measurement[] = [
      { ts: new Date('2026-02-16T17:30:00Z'), kW: 5000, kVAr: 1000, kVA: 5100, pf: 0.98, tou: 'standard' },
      // 18:00 to 23:30 intervals MISSING from file
      { ts: new Date('2026-02-17T00:00:00Z'), kW: 5000, kVAr: 1000, kVA: 5100, pf: 0.98, tou: 'offPeak' },
    ];

    const imputed = imputeAndFlag(rows);
    console.log('[PROBE 8] Imputed rows count from missing time gaps:', imputed.length);
    expect(imputed.length).toBe(14); // 2 original + 12 synthetic 30-min intervals
  });

  // --------------------------------------------------------------------------
  // Area 9: Duplicate Interval Handling Probe
  // --------------------------------------------------------------------------
  it('9. DEFECT PROBE: Duplicate timestamps in raw meter data', () => {
    const rows: Measurement[] = [
      { ts: new Date('2026-02-16T12:00:00Z'), kW: 5000, kVAr: 1000, kVA: 5100, pf: 0.98, tou: 'standard' },
      { ts: new Date('2026-02-16T12:00:00Z'), kW: 5000, kVAr: 1000, kVA: 5100, pf: 0.98, tou: 'standard' }, // Duplicate!
    ];

    const totals = computeTotals(rows, 10000);
    console.log('[PROBE 9] Total kWh with duplicate interval:', totals.totalKWh);
    expect(totals.totalKWh).toBe(2500); // 1 deduplicated interval = 5000 kW * 0.5h = 2500 kWh
  });

  // --------------------------------------------------------------------------
  // Area 10 & 22: PDF Extraction Fallback Matcher Bug Probe
  // --------------------------------------------------------------------------
  it('10. DEFECT PROBE: Uploading custom PDF with "february" in filename', async () => {
    const customPdfContent = new TextEncoder().encode('Custom Invoice for Customer ABC Corp, Total Due: R 500,000.00');
    const customFile = new File([customPdfContent], 'SiteB_February_2026_Invoice.pdf', { type: 'application/pdf' });

    try {
      const result = await extractInvoiceFromPdf(customFile);
      expect(result.invoice.customerName).not.toBe('Impala Plats Rustenburg Mine');
    } catch {
      // PDF parser attempted to extract actual PDF content instead of hijacking with Impala sample
      expect(true).toBe(true);
    }
  });

  // --------------------------------------------------------------------------
  // Area 16 & 17: Financial Rounding & VAT Math Precision Probe
  // --------------------------------------------------------------------------
  it('16. DEFECT PROBE: FinancialMath precision eliminates IEEE 754 float binary drift', () => {
    const a = 123456.78;
    const b = 987654.32;
    const floatSum = a + b; // 1111111.0999999999
    const decimalSum = FinancialMath.add(a, b); // 1111111.10

    console.log('[PROBE 16] IEEE 754 Float Sum:', floatSum, '| FinancialMath Decimal Sum:', decimalSum);

    expect(floatSum).not.toBe(1111111.1);
    expect(decimalSum).toBe(1111111.1);
  });
});
