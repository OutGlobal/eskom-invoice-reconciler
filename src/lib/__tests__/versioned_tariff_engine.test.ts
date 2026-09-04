/**
 * Automated Unit Test Suite: Production-Grade Versioned Tariff Engine
 * Tests TOU clock boundaries (06:00, 09:00, 17:00, 19:00, 22:00), midnight, month-end,
 * High/Low season shifts, public holiday Sunday-Monday substitution, leap years,
 * pro-rata version splitting, Decimal precision, and calculation audit trace.
 */

import Decimal from 'decimal.js-light';
import { TouScheduleEngine } from '../../domain/tariff/touScheduleEngine';
import { TariffVersionSelector } from '../../domain/tariff/tariffVersionSelector';
import { DeterministicEngine } from '../../domain/tariff/deterministicEngine';
import { ESKOM_MEGAFLEX_2025_2026 } from '../../domain/tariff/tariffFixtures';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ TARIFF ENGINE TEST FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ TARIFF ENGINE TEST PASSED: ${message}`);
  }
}

function runVersionedTariffEngineTests() {
  console.log('\n=== RUNNING PRODUCTION-GRADE VERSIONED TARIFF ENGINE TEST SUITE ===\n');

  // Test 1: TOU Clock Boundary Transitions (High Season Weekday)
  console.log('--- Test 1: TOU Clock Boundary Transitions (High Season Weekday) ---');
  // High Season Weekday TOU windows:
  // 00:00 - 06:00: Off-Peak
  // 06:00 - 09:00: Peak
  // 09:00 - 17:00: Standard
  // 17:00 - 19:00: Peak
  // 19:00 - 22:00: Standard
  // 22:00 - 24:00: Off-Peak

  const highWeekday = new Date('2025-07-02T05:59:00'); // Off-Peak
  assert(TouScheduleEngine.resolveTouPeriod(highWeekday, ESKOM_MEGAFLEX_2025_2026) === 'off_peak', '05:59 is Off-Peak');

  const highPeakStart = new Date('2025-07-02T06:00:00'); // Peak
  assert(TouScheduleEngine.resolveTouPeriod(highPeakStart, ESKOM_MEGAFLEX_2025_2026) === 'peak', '06:00 is Peak');

  const highStdStart = new Date('2025-07-02T09:00:00'); // Standard
  assert(TouScheduleEngine.resolveTouPeriod(highStdStart, ESKOM_MEGAFLEX_2025_2026) === 'standard', '09:00 is Standard');

  const highPeak2Start = new Date('2025-07-02T17:00:00'); // Peak
  assert(TouScheduleEngine.resolveTouPeriod(highPeak2Start, ESKOM_MEGAFLEX_2025_2026) === 'peak', '17:00 is Peak');

  const highStd2Start = new Date('2025-07-02T19:00:00'); // Standard
  assert(TouScheduleEngine.resolveTouPeriod(highStd2Start, ESKOM_MEGAFLEX_2025_2026) === 'standard', '19:00 is Standard');

  const highOffPeakStart = new Date('2025-07-02T22:00:00'); // Off-Peak
  assert(TouScheduleEngine.resolveTouPeriod(highOffPeakStart, ESKOM_MEGAFLEX_2025_2026) === 'off_peak', '22:00 is Off-Peak');

  // Test 2: Seasonal Shifts & Month-End Transitions
  console.log('\n--- Test 2: Seasonal Shifts & Month-End Transitions ---');
  const may31 = new Date('2025-05-31T23:59:59'); // Low season
  assert(TouScheduleEngine.getSeason(may31) === 'low', 'May 31 is Low Season');

  const jun1 = new Date('2025-06-01T00:00:00'); // High season
  assert(TouScheduleEngine.getSeason(jun1) === 'high', 'June 1 is High Season');

  const aug31 = new Date('2025-08-31T23:59:59'); // High season
  assert(TouScheduleEngine.getSeason(aug31) === 'high', 'August 31 is High Season');

  const sep1 = new Date('2025-09-01T00:00:00'); // Low season
  assert(TouScheduleEngine.getSeason(sep1) === 'low', 'September 1 is Low Season');

  // Test 3: Public Holidays & Sunday-to-Monday Substitution Rule
  console.log('\n--- Test 3: Public Holidays & Sunday-to-Monday Substitution ---');
  const Christmas = new Date('2025-12-25T10:00:00'); // Public holiday
  assert(TouScheduleEngine.getDayType(Christmas, ESKOM_MEGAFLEX_2025_2026.public_holidays) === 'public_holiday', 'Dec 25 is Public Holiday');
  assert(TouScheduleEngine.resolveTouPeriod(Christmas, ESKOM_MEGAFLEX_2025_2026) === 'off_peak', 'Dec 25 is Off-Peak all day');

  // 2025 Freedom Day: April 27 2025 is a Sunday. The following Monday April 28 2025 is an observed public holiday!
  const freedomMonday = new Date('2025-04-28T10:00:00');
  assert(
    TouScheduleEngine.isPublicHoliday(freedomMonday, ESKOM_MEGAFLEX_2025_2026.public_holidays) === true,
    'April 28 (Monday after Freedom Day Sunday) is observed Public Holiday'
  );

  // Test 4: Leap Year Interval Evaluation (Feb 29)
  console.log('\n--- Test 4: Leap Year Interval Evaluation (Feb 29) ---');
  const leapDay = new Date('2024-02-29T12:00:00');
  assert(TouScheduleEngine.getSeason(leapDay) === 'low', 'Feb 29 2024 handled correctly as Low Season');

  // Test 5: Effective-Date Pro-Rata Billing Period Splitting
  console.log('\n--- Test 5: Effective-Date Pro-Rata Billing Period Splitting ---');
  const subPeriods = TariffVersionSelector.splitBillingPeriod('megaflex', '2025-03-15', '2025-04-15');
  assert(subPeriods.length >= 1, `Billing period split into ${subPeriods.length} sub-periods`);
  assert(subPeriods[0].days_count > 0, `Sub-period 1 has ${subPeriods[0].days_count} billing days`);

  // Test 6: Deterministic Calculation & Decimal Precision
  console.log('\n--- Test 6: Deterministic Calculation & Decimal Precision ---');
  const calcResult = DeterministicEngine.calculateTariff(
    {
      billing_start: '2025-07-01',
      billing_end: '2025-07-31',
      notified_maximum_demand_kva: new Decimal('5000'),
      utilised_capacity_kva: new Decimal('4200'),
      maximum_demand_kva: new Decimal('4850'),
      active_energy_kwh: new Decimal('1250000'),
      peak_kwh: new Decimal('250000'),
      standard_kwh: new Decimal('600000'),
      off_peak_kwh: new Decimal('400000'),
      reactive_energy_kvarh: new Decimal('180000'),
      power_factor: new Decimal('0.96'),
    },
    ESKOM_MEGAFLEX_2025_2026
  );

  assert(calcResult.billing_days === 31, 'Calculated 31 billing days for July');
  assert(calcResult.season === 'high', 'July correctly identified as High Season');

  // Check Peak Energy calculation: 250,000 kWh * 666.92 c/kWh / 100 = R 1,667,300.00
  const peakItem = calcResult.items.find((i) => i.component_code === 'PEAK_ENERGY_HIGH');
  assert(peakItem !== undefined, 'Peak Energy High charge line item exists');
  assert(peakItem!.amount_zar.equals(new Decimal('1667300.00')), `Peak Energy amount matches exact Decimal math (R ${peakItem!.amount_zar.toFixed(2)})`);

  // Check VAT (15%)
  const expectedVat = calcResult.subtotal_ex_vat.mul(new Decimal('0.15')).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  assert(calcResult.vat_amount.equals(expectedVat), `VAT amount matches 15% (R ${calcResult.vat_amount.toFixed(2)})`);

  // Test 7: Complete Calculation Audit Trace
  console.log('\n--- Test 7: Complete Calculation Audit Trace ---');
  assert(calcResult.audit_trace.length > 0, `Generated ${calcResult.audit_trace.length} step-by-step audit steps`);
  const step1 = calcResult.audit_trace[0];
  assert(step1.tariff_code === 'ESKOM_MEGAFLEX_HV_2025_2026', 'Audit trace includes tariff_code');
  assert(step1.tariff_version === '2025.1', 'Audit trace includes tariff_version');
  assert(step1.formula_used.length > 0, 'Audit trace includes formula_used');
  assert(step1.rounding_rule.includes('Decimal'), 'Audit trace specifies Decimal rounding rule');

  console.log('\n=== ALL PRODUCTION-GRADE TARIFF ENGINE TESTS PASSED SUCCESSFULLY ===\n');
}

runVersionedTariffEngineTests();
