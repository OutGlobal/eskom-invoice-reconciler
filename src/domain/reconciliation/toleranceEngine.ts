/**
 * Configurable Tolerance Engine
 * Multi-layer tolerance evaluator for utility reconciliation comparisons
 */

import Decimal from 'decimal.js-light';
import type { ComponentTolerance, ReconciliationConfig } from './types';

export class ToleranceEngine {
  /**
   * Default Configurable Tolerance Matrix
   */
  public static readonly DEFAULT_CONFIG: ReconciliationConfig = {
    utility_id: 'eskom_default',
    tariff_code: 'ESKOM_MEGAFLEX_HV_2025_2026',
    tolerances: {
      PEAK_KWH: {
        component_code: 'PEAK_KWH',
        component_name: 'Peak Energy (kWh)',
        absolute_tolerance_zar: new Decimal('100.00'), // 100 kWh
        percentage_tolerance: new Decimal('0.001'),   // 0.1%
        unit: 'kWh',
      },
      STANDARD_KWH: {
        component_code: 'STANDARD_KWH',
        component_name: 'Standard Energy (kWh)',
        absolute_tolerance_zar: new Decimal('100.00'),
        percentage_tolerance: new Decimal('0.001'),
        unit: 'kWh',
      },
      OFF_PEAK_KWH: {
        component_code: 'OFF_PEAK_KWH',
        component_name: 'Off-Peak Energy (kWh)',
        absolute_tolerance_zar: new Decimal('100.00'),
        percentage_tolerance: new Decimal('0.001'),
        unit: 'kWh',
      },
      TOTAL_KWH: {
        component_code: 'TOTAL_KWH',
        component_name: 'Total Energy (kWh)',
        absolute_tolerance_zar: new Decimal('200.00'),
        percentage_tolerance: new Decimal('0.001'),
        unit: 'kWh',
      },
      DEMAND_KVA: {
        component_code: 'DEMAND_KVA',
        component_name: 'Maximum Demand (kVA)',
        absolute_tolerance_zar: new Decimal('5.00'),   // 5 kVA
        percentage_tolerance: new Decimal('0.005'),   // 0.5%
        unit: 'kVA',
      },
      REACTIVE_KVARH: {
        component_code: 'REACTIVE_KVARH',
        component_name: 'Reactive Energy (kVARh)',
        absolute_tolerance_zar: new Decimal('50.00'),
        percentage_tolerance: new Decimal('0.005'),
        unit: 'kVARh',
      },
      NETWORK_CHARGES: {
        component_code: 'NETWORK_CHARGES',
        component_name: 'Network Charges',
        absolute_tolerance_zar: new Decimal('10.00'), // R10.00
        percentage_tolerance: new Decimal('0.0005'),  // 0.05%
        unit: 'ZAR',
      },
      CAPACITY_CHARGES: {
        component_code: 'CAPACITY_CHARGES',
        component_name: 'Capacity Charges',
        absolute_tolerance_zar: new Decimal('10.00'),
        percentage_tolerance: new Decimal('0.0005'),
        unit: 'ZAR',
      },
      SERVICE_CHARGES: {
        component_code: 'SERVICE_CHARGES',
        component_name: 'Service Charges',
        absolute_tolerance_zar: new Decimal('0.10'), // R0.10
        percentage_tolerance: new Decimal('0.0001'),
        unit: 'ZAR',
      },
      RELIABILITY_SERVICES: {
        component_code: 'RELIABILITY_SERVICES',
        component_name: 'Reliability Services',
        absolute_tolerance_zar: new Decimal('5.00'),
        percentage_tolerance: new Decimal('0.001'),
        unit: 'ZAR',
      },
      LEVIES: {
        component_code: 'LEVIES',
        component_name: 'Levies',
        absolute_tolerance_zar: new Decimal('5.00'),
        percentage_tolerance: new Decimal('0.001'),
        unit: 'ZAR',
      },
      VAT_AMOUNT: {
        component_code: 'VAT_AMOUNT',
        component_name: 'VAT Amount',
        absolute_tolerance_zar: new Decimal('5.00'),
        percentage_tolerance: new Decimal('0.0005'),
        unit: 'ZAR',
      },
      TOTAL_BILL: {
        component_code: 'TOTAL_BILL',
        component_name: 'Total Invoice Amount',
        absolute_tolerance_zar: new Decimal('5.00'), // R5.00
        percentage_tolerance: new Decimal('0.0005'),  // 0.05%
        unit: 'ZAR',
      },
    },
  };

  /**
   * Get component tolerance configuration
   */
  public static getTolerance(
    componentCode: string,
    config: ReconciliationConfig = this.DEFAULT_CONFIG
  ): ComponentTolerance {
    return (
      config.tolerances[componentCode] || {
        component_code: componentCode,
        component_name: componentCode,
        absolute_tolerance_zar: new Decimal('5.00'),
        percentage_tolerance: new Decimal('0.001'),
        unit: 'ZAR',
      }
    );
  }

  /**
   * Evaluate if a variance is within acceptable tolerance
   */
  public static evaluateTolerance(
    billed: Decimal,
    calculated: Decimal,
    tolerance: ComponentTolerance
  ): { isWithinTolerance: boolean; isRoundingOnly: boolean; absVar: Decimal; pctVar: Decimal } {
    const absVar = billed.sub(calculated).abs();
    
    let pctVar = new Decimal(0);
    if (calculated.gt(0)) {
      pctVar = absVar.div(calculated);
    } else if (billed.gt(0)) {
      pctVar = absVar.div(billed);
    }

    const isAbsOK = absVar.lte(tolerance.absolute_tolerance_zar);
    const isPctOK = pctVar.lte(tolerance.percentage_tolerance);

    const isWithinTolerance = isAbsOK || isPctOK;
    const isRoundingOnly = absVar.gt(0) && absVar.lte(new Decimal('0.10'));

    return {
      isWithinTolerance,
      isRoundingOnly,
      absVar,
      pctVar,
    };
  }
}
