/**
 * Multi-Site Hierarchy Service (Stage 35)
 *
 * Implements the authoritative architectural hierarchy:
 * Organisation
 *  ├── Customer
 *  │    ├── Site
 *  │    │    ├── Meter
 *  │    │    └── Invoices
 *  │    └── Site
 *  │
 *  └── Customer
 *
 * A single organisation may have many customers, sites, meters, and invoices.
 * Designed from the ground up for multi-site and multi-meter scalability.
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { InvoiceStorageService } from "../invoice/invoiceStorageService";
import { ReconciliationStorageService } from "../reconciliation/reconciliationStorageService";

export interface MeterNode {
  id: string;
  siteId: string;
  meterNumber: string;
  multiplier: number;
  tariffCode?: string;
  meterType?: string;
  status?: string;
  lastReadingDate?: string;
}

export interface InvoiceSummaryNode {
  id: string;
  invoiceNumber: string;
  accountNumber: string;
  siteId: string;
  meterId?: string;
  billingPeriod: string;
  billingStart?: string | null;
  billingEnd?: string | null;
  totalKwh: number;
  billedTotalZar: number;
  expectedTotalZar?: number;
  varianceZar?: number;
  status: string;
}

export interface SiteNode {
  id: string;
  customerId: string;
  organisationId: string;
  siteName: string;
  siteCode: string;
  address?: string;
  supplyVoltageKv?: number;
  nmdKva?: number;
  meters: MeterNode[];
  invoices: InvoiceSummaryNode[];
}

export interface CustomerNode {
  id: string;
  organisationId: string;
  customerName: string;
  accountNumber: string;
  contactEmail?: string;
  sites: SiteNode[];
}

export interface OrganisationNode {
  id: string;
  name: string;
  code?: string;
  customers: CustomerNode[];
}

export interface MultiSiteHierarchyTree {
  organisations: OrganisationNode[];
  totalOrganisations: number;
  totalCustomers: number;
  totalSites: number;
  totalMeters: number;
  totalInvoices: number;
}

export interface HierarchyMetricsRollup {
  totalCustomers: number;
  totalSites: number;
  totalMeters: number;
  totalInvoices: number;
  invoicesProcessed: number;
  totalBilledZar: number;
  totalExpectedZar: number;
  totalVarianceZar: number;
  potentialDiscrepanciesZar: number;
}

export class MultiSiteHierarchyService {
  // In-memory repositories for test runs, offline resilience, and fast access
  private static memOrganisations: Map<string, { id: string; name: string; code?: string }> =
    new Map();
  private static memCustomers: Map<
    string,
    { id: string; organisationId: string; customerName: string; accountNumber: string; contactEmail?: string }
  > = new Map();
  private static memSites: Map<
    string,
    {
      id: string;
      customerId: string;
      organisationId: string;
      siteName: string;
      siteCode: string;
      address?: string;
      supplyVoltageKv?: number;
      nmdKva?: number;
    }
  > = new Map();
  private static memMeters: Map<
    string,
    {
      id: string;
      siteId: string;
      meterNumber: string;
      multiplier: number;
      tariffCode?: string;
      meterType?: string;
      status?: string;
    }
  > = new Map();

  /**
   * Reset the in-memory cache
   */
  public static clearMemoryStore(): void {
    this.memOrganisations.clear();
    this.memCustomers.clear();
    this.memSites.clear();
    this.memMeters.clear();
  }

  /**
   * Register an organisation in the hierarchy
   */
  public static registerOrganisation(org: { id?: string; name: string; code?: string }): {
    id: string;
    name: string;
    code?: string;
  } {
    const id = org.id || `org-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const record = { id, name: org.name, code: org.code };
    this.memOrganisations.set(id, record);
    return record;
  }

  /**
   * Register a customer under an organisation
   */
  public static registerCustomer(cust: {
    id?: string;
    organisationId: string;
    customerName: string;
    accountNumber: string;
    contactEmail?: string;
  }): { id: string; organisationId: string; customerName: string; accountNumber: string; contactEmail?: string } {
    const id = cust.id || `cust-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const record = {
      id,
      organisationId: cust.organisationId,
      customerName: cust.customerName,
      accountNumber: cust.accountNumber,
      contactEmail: cust.contactEmail,
    };
    this.memCustomers.set(id, record);
    return record;
  }

  /**
   * Register a site under a customer and organisation
   */
  public static registerSite(site: {
    id?: string;
    customerId: string;
    organisationId: string;
    siteName: string;
    siteCode: string;
    address?: string;
    supplyVoltageKv?: number;
    nmdKva?: number;
  }): {
    id: string;
    customerId: string;
    organisationId: string;
    siteName: string;
    siteCode: string;
    address?: string;
    supplyVoltageKv?: number;
    nmdKva?: number;
  } {
    const id = site.id || `site-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const record = {
      id,
      customerId: site.customerId,
      organisationId: site.organisationId,
      siteName: site.siteName,
      siteCode: site.siteCode,
      address: site.address,
      supplyVoltageKv: site.supplyVoltageKv,
      nmdKva: site.nmdKva,
    };
    this.memSites.set(id, record);
    return record;
  }

  /**
   * Register a meter under a site
   */
  public static registerMeter(meter: {
    id?: string;
    siteId: string;
    meterNumber: string;
    multiplier?: number;
    tariffCode?: string;
    meterType?: string;
    status?: string;
  }): MeterNode {
    const id = meter.id || `mtr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const record: MeterNode = {
      id,
      siteId: meter.siteId,
      meterNumber: meter.meterNumber,
      multiplier: meter.multiplier ?? 1.0,
      tariffCode: meter.tariffCode,
      meterType: meter.meterType || "AMR_MAIN",
      status: meter.status || "ACTIVE",
    };
    this.memMeters.set(id, record);
    return record;
  }

  private static async withTimeout<T>(promise: PromiseLike<T>, ms = 600): Promise<T> {
    let timer: any;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Supabase request timeout")), ms);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Build the complete multi-site hierarchy tree:
   * Organisation -> Customer -> Site -> (Meter & Invoices)
   */
  public static async buildHierarchy(
    targetOrganisationId?: string,
  ): Promise<MultiSiteHierarchyTree> {
    // 1. Fetch Organisations from DB and Memory
    const orgMap = new Map<string, { id: string; name: string; code?: string }>();
    if (isSupabaseConfigured) {
      try {
        let q = supabase.from("organisations").select("id, name, code");
        if (targetOrganisationId) {
          q = q.eq("id", targetOrganisationId);
        }
        const res = await this.withTimeout(q);
        const dbOrgs = res?.data;
        for (const o of dbOrgs || []) {
          orgMap.set(o.id, o);
        }
      } catch {
        // Non-blocking fallback
      }
    }
    for (const [id, o] of this.memOrganisations.entries()) {
      if (!targetOrganisationId || id === targetOrganisationId) {
        orgMap.set(id, o);
      }
    }

    // 2. Fetch Customers
    const customerMap = new Map<
      string,
      { id: string; organisationId: string; customerName: string; accountNumber: string; contactEmail?: string }
    >();
    if (isSupabaseConfigured) {
      try {
        let q = supabase.from("customers").select("id, organisation_id, customer_name, account_number, contact_email");
        if (targetOrganisationId) {
          q = q.eq("organisation_id", targetOrganisationId);
        }
        const res = await this.withTimeout(q);
        const dbCusts = res?.data;
        for (const c of dbCusts || []) {
          customerMap.set(c.id, {
            id: c.id,
            organisationId: c.organisation_id,
            customerName: c.customer_name,
            accountNumber: c.account_number,
            contactEmail: c.contact_email,
          });
        }
      } catch {
        // Non-blocking
      }
    }
    for (const [id, c] of this.memCustomers.entries()) {
      if (!targetOrganisationId || c.organisationId === targetOrganisationId) {
        customerMap.set(id, c);
      }
    }

    // 3. Fetch Sites
    const siteMap = new Map<
      string,
      {
        id: string;
        customerId: string;
        organisationId: string;
        siteName: string;
        siteCode: string;
        address?: string;
        supplyVoltageKv?: number;
        nmdKva?: number;
      }
    >();
    if (isSupabaseConfigured) {
      try {
        let q = supabase.from("sites").select("id, customer_id, organisation_id, site_name, site_code, address, supply_voltage_kv, nmd_kva");
        if (targetOrganisationId) {
          q = q.eq("organisation_id", targetOrganisationId);
        }
        const res = await this.withTimeout(q);
        const dbSites = res?.data;
        for (const s of dbSites || []) {
          siteMap.set(s.id, {
            id: s.id,
            customerId: s.customer_id,
            organisationId: s.organisation_id,
            siteName: s.site_name,
            siteCode: s.site_code,
            address: s.address,
            supplyVoltageKv: s.supply_voltage_kv,
            nmdKva: s.nmd_kva,
          });
        }
      } catch {
        // Non-blocking
      }
    }
    for (const [id, s] of this.memSites.entries()) {
      if (!targetOrganisationId || s.organisationId === targetOrganisationId) {
        siteMap.set(id, s);
      }
    }

    // 4. Fetch Meters
    const meterMap = new Map<string, MeterNode>();
    if (isSupabaseConfigured) {
      try {
        const res = await this.withTimeout(supabase.from("meters").select("*"));
        const dbMeters = res?.data;
        for (const m of dbMeters || []) {
          meterMap.set(m.id, {
            id: m.id,
            siteId: m.site_id,
            meterNumber: m.meter_number,
            multiplier: Number(m.multiplier) || 1.0,
            tariffCode: m.tariff_code,
            meterType: m.meter_type || "AMR_MAIN",
            status: m.status || "ACTIVE",
          });
        }
      } catch {
        // Non-blocking
      }
    }
    for (const [id, m] of this.memMeters.entries()) {
      meterMap.set(id, m);
    }

    // 5. Fetch Invoices and link to Sites / Meters
    const invoiceList: InvoiceSummaryNode[] = [];
    if (isSupabaseConfigured) {
      try {
        let q = supabase.from("invoice_records").select("*");
        if (targetOrganisationId) {
          q = q.eq("organisation_id", targetOrganisationId);
        }
        const res = await this.withTimeout(q);
        const dbInvoices = res?.data;
        for (const inv of dbInvoices || []) {
          invoiceList.push({
            id: inv.id,
            invoiceNumber: inv.invoice_number || inv.id,
            accountNumber: inv.account_number,
            siteId: inv.site_id,
            meterId: inv.meter_id,
            billingPeriod: inv.billing_period || "Monthly",
            billingStart: inv.billing_start,
            billingEnd: inv.billing_end,
            totalKwh: Number(inv.total_kwh) || 0,
            billedTotalZar: Number(inv.invoiced_total) || 0,
            expectedTotalZar: inv.reconciled_total ? Number(inv.reconciled_total) : undefined,
            varianceZar: inv.variance_amount !== undefined ? Number(inv.variance_amount) : undefined,
            status: inv.status || "VALIDATED",
          });
        }
      } catch {
        // Non-blocking
      }
    }

    // Also include in-memory invoice records
    try {
      const memInvoices = InvoiceStorageService.getMemoryRecords();
      for (const inv of memInvoices || []) {
        const invOrg = inv.organisation_id || inv.organisationId;
        if (targetOrganisationId && invOrg && invOrg !== targetOrganisationId) {
          continue;
        }
        const invId = inv.id || inv.invoice_number || inv.invoiceNumber;
        if (!invoiceList.some((x) => x.id === invId || x.invoiceNumber === invId)) {
          invoiceList.push({
            id: invId,
            invoiceNumber: inv.invoice_number || inv.invoiceNumber || invId,
            accountNumber: inv.account_number || inv.accountNumber || "ACC-DEFAULT",
            siteId: inv.site_id || inv.siteId || "SITE-DEFAULT",
            meterId: inv.meter_id || inv.meterId,
            billingPeriod: inv.billing_period || "Monthly",
            billingStart: inv.billing_start,
            billingEnd: inv.billing_end,
            totalKwh: Number(inv.total_kwh || inv.totalKwh) || 0,
            billedTotalZar: Number(inv.invoiced_total || inv.totalAmount) || 0,
            expectedTotalZar: inv.reconciled_total ? Number(inv.reconciled_total) : undefined,
            varianceZar: inv.variance_amount !== undefined ? Number(inv.variance_amount) : undefined,
            status: inv.status || "VALIDATED",
          });
        }
      }
    } catch {
      // Non-blocking
    }

    // 6. Synthesize any missing parent nodes from Invoices to ensure zero orphaned data
    for (const inv of invoiceList) {
      // Ensure site exists
      const sId = inv.siteId || "SITE-DEFAULT";
      if (!siteMap.has(sId)) {
        siteMap.set(sId, {
          id: sId,
          customerId: inv.accountNumber || "CUST-DEFAULT",
          organisationId: targetOrganisationId || "ORG-DEFAULT",
          siteName: `Facility (${sId})`,
          siteCode: sId,
        });
      }
      // Ensure customer exists
      const custId = siteMap.get(sId)!.customerId;
      if (!customerMap.has(custId)) {
        customerMap.set(custId, {
          id: custId,
          organisationId: siteMap.get(sId)!.organisationId,
          customerName: `Customer (${inv.accountNumber || custId})`,
          accountNumber: inv.accountNumber || custId,
        });
      }
      // Ensure organisation exists
      const orgId = customerMap.get(custId)!.organisationId;
      if (!orgMap.has(orgId)) {
        orgMap.set(orgId, {
          id: orgId,
          name: targetOrganisationId === orgId ? "Enterprise Portfolio" : `Organisation (${orgId})`,
        });
      }
    }

    // 7. Assemble the Tree: Organisation -> Customer -> Site -> (Meters & Invoices)
    const orgNodes: OrganisationNode[] = [];
    let totalCustCount = 0;
    let totalSiteCount = 0;
    let totalMeterCount = 0;
    let totalInvCount = 0;

    for (const [oId, oData] of orgMap.entries()) {
      const custNodes: CustomerNode[] = [];

      for (const [cId, cData] of customerMap.entries()) {
        if (cData.organisationId !== oId) continue;

        const siteNodes: SiteNode[] = [];
        for (const [sId, sData] of siteMap.entries()) {
          if (sData.customerId !== cId) continue;

          // Collect meters for this site
          const metersForSite: MeterNode[] = [];
          for (const m of meterMap.values()) {
            if (m.siteId === sId) {
              metersForSite.push(m);
            }
          }

          // Collect invoices for this site
          const invoicesForSite = invoiceList.filter((inv) => {
            if (inv.siteId) {
              return inv.siteId === sId;
            }
            return inv.accountNumber === cData.accountNumber;
          });

          siteNodes.push({
            id: sData.id,
            customerId: sData.customerId,
            organisationId: sData.organisationId,
            siteName: sData.siteName,
            siteCode: sData.siteCode,
            address: sData.address,
            supplyVoltageKv: sData.supplyVoltageKv,
            nmdKva: sData.nmdKva,
            meters: metersForSite,
            invoices: invoicesForSite,
          });

          totalMeterCount += metersForSite.length;
          totalInvCount += invoicesForSite.length;
        }

        custNodes.push({
          id: cData.id,
          organisationId: cData.organisationId,
          customerName: cData.customerName,
          accountNumber: cData.accountNumber,
          contactEmail: cData.contactEmail,
          sites: siteNodes,
        });

        totalSiteCount += siteNodes.length;
      }

      orgNodes.push({
        id: oData.id,
        name: oData.name,
        code: oData.code,
        customers: custNodes,
      });

      totalCustCount += custNodes.length;
    }

    return {
      organisations: orgNodes,
      totalOrganisations: orgNodes.length,
      totalCustomers: totalCustCount,
      totalSites: totalSiteCount,
      totalMeters: totalMeterCount,
      totalInvoices: totalInvCount,
    };
  }

  /**
   * Filter hierarchy tree down to specific Customer, Site, or Meter
   */
  public static filterHierarchy(
    tree: MultiSiteHierarchyTree,
    filter: { customerId?: string; siteId?: string; meterId?: string },
  ): MultiSiteHierarchyTree {
    if (!filter.customerId && !filter.siteId && !filter.meterId) {
      return tree;
    }

    const filteredOrgs: OrganisationNode[] = [];
    let custCount = 0;
    let siteCount = 0;
    let meterCount = 0;
    let invCount = 0;

    for (const org of tree.organisations) {
      const filteredCustomers: CustomerNode[] = [];

      for (const cust of org.customers) {
        if (filter.customerId && cust.id !== filter.customerId && cust.accountNumber !== filter.customerId) {
          continue;
        }

        const filteredSites: SiteNode[] = [];
        for (const site of cust.sites) {
          if (filter.siteId && site.id !== filter.siteId && site.siteCode !== filter.siteId) {
            continue;
          }

          let siteMeters = site.meters;
          if (filter.meterId) {
            siteMeters = siteMeters.filter(
              (m) => m.id === filter.meterId || m.meterNumber === filter.meterId,
            );
            if (siteMeters.length === 0) continue;
          }

          let siteInvoices = site.invoices;
          if (filter.meterId) {
            siteInvoices = siteInvoices.filter((inv) => inv.meterId === filter.meterId);
          }

          filteredSites.push({
            ...site,
            meters: siteMeters,
            invoices: siteInvoices,
          });

          meterCount += siteMeters.length;
          invCount += siteInvoices.length;
        }

        if (filteredSites.length > 0) {
          filteredCustomers.push({
            ...cust,
            sites: filteredSites,
          });
          siteCount += filteredSites.length;
        }
      }

      if (filteredCustomers.length > 0) {
        filteredOrgs.push({
          ...org,
          customers: filteredCustomers,
        });
        custCount += filteredCustomers.length;
      }
    }

    return {
      organisations: filteredOrgs,
      totalOrganisations: filteredOrgs.length,
      totalCustomers: custCount,
      totalSites: siteCount,
      totalMeters: meterCount,
      totalInvoices: invCount,
    };
  }

  /**
   * Aggregate metrics at any level of the hierarchy
   */
  public static aggregateMetrics(
    node: OrganisationNode | CustomerNode | SiteNode,
  ): HierarchyMetricsRollup {
    let customers = 0;
    let sites = 0;
    let meters = 0;
    let invoices = 0;
    let processed = 0;
    let billed = 0;
    let expected = 0;
    let variance = 0;
    let discrepancies = 0;

    const processSite = (s: SiteNode) => {
      sites++;
      meters += s.meters.length;
      invoices += s.invoices.length;

      for (const inv of s.invoices) {
        if (inv.status !== "DRAFT" && inv.status !== "PENDING") {
          processed++;
        }
        billed += inv.billedTotalZar;
        if (inv.expectedTotalZar !== undefined) {
          expected += inv.expectedTotalZar;
        }
        if (inv.varianceZar !== undefined) {
          variance += inv.varianceZar;
          if (Math.abs(inv.varianceZar) > 5) {
            discrepancies += Math.abs(inv.varianceZar);
          }
        }
      }
    };

    if ("customers" in node) {
      // OrganisationNode
      customers = node.customers.length;
      for (const c of node.customers) {
        for (const s of c.sites) {
          processSite(s);
        }
      }
    } else if ("sites" in node) {
      // CustomerNode
      customers = 1;
      for (const s of node.sites) {
        processSite(s);
      }
    } else {
      // SiteNode
      customers = 1;
      processSite(node);
    }

    return {
      totalCustomers: customers,
      totalSites: sites,
      totalMeters: meters,
      totalInvoices: invoices,
      invoicesProcessed: processed,
      totalBilledZar: billed,
      totalExpectedZar: expected,
      totalVarianceZar: variance,
      potentialDiscrepanciesZar: discrepancies,
    };
  }
}
