/**
 * Governance Administration Service
 * Manages Organisations, Users, Roles, Sites, Meters, Tariff Assignments,
 * Parser Versions, Tolerance Settings, Calendars, Data Retention, and System Audit Logs.
 */

import {
  GovernanceSettings,
  OrganisationRecord,
  UserAccountRecord,
  SiteRecord,
  MeterRecord,
  PublicHolidayCalendar,
  ToleranceSettings,
  DataRetentionPolicy,
} from "./types";

export class GovernanceAdminService {
  private static defaultSettings: GovernanceSettings = {
    organisation: {
      id: "org-001",
      name: "OutGlobal Energy Enterprise",
      code: "OUTGLOBAL-ZA",
      contactEmail: "admin@outglobal.co.za",
      status: "ACTIVE",
      createdAt: "2026-01-01T00:00:00Z",
    },
    tolerance: {
      varianceToleranceZar: 1000.0,
      varianceTolerancePct: 1.0,
      powerFactorThreshold: 0.96,
      ocrConfidenceThreshold: 85.0,
      nmdThresholdPct: 100.0,
    },
    dataRetention: {
      retentionPeriodYears: 7,
      autoArchiveEnabled: true,
      legalHoldActive: false,
      lastArchivedAt: "2026-06-30T23:59:59Z",
    },
    calendar: {
      calendarId: "cal-za-2026",
      name: "South Africa Gazetted Holidays 2026",
      region: "ZA",
      holidays: [
        { date: "2026-01-01", name: "New Year's Day", isObservedMonday: false },
        { date: "2026-03-21", name: "Human Rights Day", isObservedMonday: false },
        { date: "2026-04-03", name: "Good Friday", isObservedMonday: false },
        { date: "2026-04-06", name: "Family Day", isObservedMonday: false },
        { date: "2026-04-27", name: "Freedom Day", isObservedMonday: false },
        { date: "2026-05-01", name: "Workers' Day", isObservedMonday: false },
        { date: "2026-06-16", name: "Youth Day", isObservedMonday: false },
        { date: "2026-08-09", name: "National Women's Day", isObservedMonday: true }, // Sunday -> Monday Aug 10
        { date: "2026-09-24", name: "Heritage Day", isObservedMonday: false },
        { date: "2026-12-16", name: "Day of Reconciliation", isObservedMonday: false },
        { date: "2026-12-25", name: "Christmas Day", isObservedMonday: false },
        { date: "2026-12-26", name: "Day of Goodwill", isObservedMonday: false },
      ],
    },
    parserVersion: "v1.4.2",
    calculationEngineVersion: "v2.1.0-nersa2026",
  };

  private static sampleUsers: UserAccountRecord[] = [
    {
      id: "usr-admin-01",
      organisationId: "org-001",
      email: "super.admin@outglobal.co.za",
      fullName: "System Super Administrator",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      lastLoginAt: "2026-09-04T16:00:00Z",
    },
    {
      id: "usr-auditor-01",
      organisationId: "org-001",
      email: "lead.auditor@outglobal.co.za",
      fullName: "Senior Energy Auditor",
      role: "AUDITOR",
      status: "ACTIVE",
      lastLoginAt: "2026-09-04T15:30:00Z",
    },
    {
      id: "usr-mgr-01",
      organisationId: "org-001",
      email: "energy.mgr@outglobal.co.za",
      fullName: "Site Energy Manager",
      role: "ENERGY_MANAGER",
      status: "ACTIVE",
      lastLoginAt: "2026-09-04T14:15:00Z",
    },
    {
      id: "usr-rev-01",
      organisationId: "org-001",
      email: "finance.reviewer@outglobal.co.za",
      fullName: "Finance Approver",
      role: "REVIEWER",
      status: "ACTIVE",
      lastLoginAt: "2026-09-04T12:00:00Z",
    },
  ];

  private static sampleSites: SiteRecord[] = [
    {
      id: "site-001",
      organisationId: "org-001",
      name: "AngloGold Ashanti - West Wits Complex",
      code: "SITE-AGA-WW",
      address: "Carletonville, Gauteng, South Africa",
      nmdKva: 5000,
      supplyVoltageKv: 132,
    },
    {
      id: "site-002",
      organisationId: "org-001",
      name: "Sasol Secunda Chemical Complex",
      code: "SITE-SAS-SEC",
      address: "Secunda, Mpumalanga, South Africa",
      nmdKva: 12000,
      supplyVoltageKv: 275,
    },
  ];

  private static sampleMeters: MeterRecord[] = [
    {
      id: "meter-001",
      siteId: "site-001",
      meterSerialNumber: "ESK-AGA-99104",
      ctRatio: "400/5",
      vtRatio: "132000/110",
      multiplier: 1.0,
      assignedTariffCode: "megaflex",
    },
    {
      id: "meter-002",
      siteId: "site-002",
      meterSerialNumber: "ESK-SAS-88192",
      ctRatio: "1000/5",
      vtRatio: "275000/110",
      multiplier: 1.0,
      assignedTariffCode: "miniflex",
    },
  ];

  public static resetDefaults(): void {
    this.defaultSettings = {
      organisation: {
        id: "org-001",
        name: "OutGlobal Energy Enterprise",
        code: "OUTGLOBAL-ZA",
        contactEmail: "admin@outglobal.co.za",
        status: "ACTIVE",
        createdAt: "2026-01-01T00:00:00Z",
      },
      tolerance: {
        varianceToleranceZar: 1000.0,
        varianceTolerancePct: 1.0,
        powerFactorThreshold: 0.96,
        ocrConfidenceThreshold: 85.0,
        nmdThresholdPct: 100.0,
      },
      dataRetention: {
        retentionPeriodYears: 7,
        autoArchiveEnabled: true,
        legalHoldActive: false,
        lastArchivedAt: "2026-06-30T23:59:59Z",
      },
      calendar: {
        calendarId: "cal-za-2026",
        name: "South Africa Gazetted Holidays 2026",
        region: "ZA",
        holidays: [
          { date: "2026-01-01", name: "New Year's Day", isObservedMonday: false },
          { date: "2026-03-21", name: "Human Rights Day", isObservedMonday: false },
          { date: "2026-04-03", name: "Good Friday", isObservedMonday: false },
          { date: "2026-04-06", name: "Family Day", isObservedMonday: false },
          { date: "2026-04-27", name: "Freedom Day", isObservedMonday: false },
          { date: "2026-05-01", name: "Workers' Day", isObservedMonday: false },
          { date: "2026-06-16", name: "Youth Day", isObservedMonday: false },
          { date: "2026-08-09", name: "National Women's Day", isObservedMonday: true },
          { date: "2026-09-24", name: "Heritage Day", isObservedMonday: false },
          { date: "2026-12-16", name: "Day of Reconciliation", isObservedMonday: false },
          { date: "2026-12-25", name: "Christmas Day", isObservedMonday: false },
          { date: "2026-12-26", name: "Day of Goodwill", isObservedMonday: false },
        ],
      },
      parserVersion: "v1.4.2",
      calculationEngineVersion: "v2.1.0-nersa2026",
    };
  }

  public static getGovernanceSettings(): GovernanceSettings {
    return { ...this.defaultSettings };
  }

  public static updateToleranceSettings(newTolerance: Partial<ToleranceSettings>): GovernanceSettings {
    this.defaultSettings.tolerance = {
      ...this.defaultSettings.tolerance,
      ...newTolerance,
    };
    return this.getGovernanceSettings();
  }

  public static updateDataRetentionPolicy(newPolicy: Partial<DataRetentionPolicy>): GovernanceSettings {
    this.defaultSettings.dataRetention = {
      ...this.defaultSettings.dataRetention,
      ...newPolicy,
    };
    return this.getGovernanceSettings();
  }

  public static getUsers(): UserAccountRecord[] {
    return [...this.sampleUsers];
  }

  public static getSites(): SiteRecord[] {
    return [...this.sampleSites];
  }

  public static getMeters(): MeterRecord[] {
    return [...this.sampleMeters];
  }

  public static assignMeterTariff(meterId: string, tariffCode: string): MeterRecord | undefined {
    const meter = this.sampleMeters.find((m) => m.id === meterId);
    if (meter) {
      meter.assignedTariffCode = tariffCode;
    }
    return meter;
  }
}
