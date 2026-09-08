/**
 * Evidence Storage Service
 * Enterprise Persistence Service for 12-Node Evidence Chains & Authorization Security
 * Interacts with Supabase `evidence_chains` and `evidence_chain_nodes` with fallback to engine.
 */

import { supabase } from "@/integrations/supabase/client";
import type { CompleteEvidenceChain, AuthorizationContext } from "./types";
import { EvidenceChainEngine } from "./evidenceChainEngine";

export class EvidenceStorageService {
  /**
   * Fetch complete 12-node evidence chain by variance ID or return fixture chain
   */
  public static async getEvidenceChain(
    varianceId: string,
    authContext?: AuthorizationContext
  ): Promise<CompleteEvidenceChain | null> {
    try {
      const { data: dbChain, error } = await supabase
        .from("evidence_chains")
        .select("*")
        .eq("variance_id", varianceId)
        .maybeSingle();

      if (error || !dbChain) {
        console.warn("[EvidenceStorageService] Supabase evidence chain empty or unavailable, building fixture chain.");
        return EvidenceChainEngine.buildChain(varianceId, "RECON-RUN-01", authContext);
      }

      const { data: dbNodes } = await supabase
        .from("evidence_chain_nodes")
        .select("*")
        .eq("chain_id", dbChain.chain_id)
        .order("sequence_index", { ascending: true });

      const chain: CompleteEvidenceChain = {
        chain_id: dbChain.chain_id,
        variance_id: dbChain.variance_id,
        reconciliation_run_id: dbChain.reconciliation_run_id,
        invoice_id: dbChain.invoice_id,
        tenant_id: dbChain.tenant_id,
        site_id: dbChain.site_id,
        nodes: (dbNodes || []).map((n: any) => ({
          node_id: n.node_id,
          node_type: n.node_type,
          stable_object_id: n.stable_object_id,
          title: n.title,
          sequence_index: n.sequence_index,
          node_data: n.node_data,
        })),
        created_at: dbChain.created_at,
      };

      if (authContext) {
        const isAuthorized = EvidenceChainEngine.checkAuthorization(chain, authContext);
        if (!isAuthorized) {
          console.warn("[EvidenceStorageService] Unauthorized access attempt blocked.");
          return null;
        }
      }

      return chain;
    } catch (e) {
      console.warn("[EvidenceStorageService] Exception fetching evidence chain:", e);
      return EvidenceChainEngine.buildChain(varianceId, "RECON-RUN-01", authContext);
    }
  }
}
