import { describe, it, expect, beforeEach } from "vitest";
import Decimal from "decimal.js-light";
import {
  TariffImportPipeline,
  TariffProvenanceModel,
  TariffStorageService,
  TariffVersionSelector,
  type TariffRateProvenance,
} from "../../domain/tariff";

describe("ENERA Requirements 7 & 8 — Tariff Source, Provenance & Import Pipeline", () => {
  beforeEach(() => {
    TariffImportPipeline.reset();
    TariffVersionSelector.reset();
  });

  describe("Requirement 7: Tariff Source and Provenance", () => {
    it("preserves the complete 8-tier provenance chain for every imported rate component", () => {
      const mockProvenance: TariffRateProvenance = TariffProvenanceModel.createProvenance({
        tariffCode: "MEGAFLEX",
        tariffVersion: "2025.1",
        componentCode: "ACTIVE_ENERGY_PEAK",
        ruleId: "RULE_MEGAFLEX_PEAK_HIGH",
        sourceDocument: {
          document_id: "DOC_NERSA_2025_BOOKLET",
          filename: "Eskom_Tariff_Booklet_2025_2026.pdf",
          file_hash_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          file_size_bytes: 4521000,
          mime_type: "application/pdf",
          document_type: "GAZETTE_PDF",
        },
        location: {
          page_number: 18,
          table_id: "TAB_4.2",
          table_name: "Megaflex Active Energy TOU Table",
          row_index: 3,
          cell_coordinate: "Col 4 (High Season Peak)",
          raw_text_snippet: "High Season Peak Rate: 666.92 c/kWh",
        },
        importRun: {
          run_id: "RUN_20250601_001",
          imported_at: "2025-06-01T09:00:00Z",
          imported_by: "system.ingestion@enera.internal",
          adapter_used: "TariffPdfAdapter",
          extraction_confidence: 0.98,
          ai_assisted_interpretation: true,
          ambiguity_flags: [],
        },
        reviewAndApproval: {
          approval_status: "approved",
          approved_by: "specialist.energy@enera.internal",
          approved_at: "2025-06-02T11:15:00Z",
          approval_notes: "Checked against NERSA Decision Gazette 2025",
          gazette_verified: true,
        },
      });

      const chainString = TariffProvenanceModel.formatProvenanceChain(mockProvenance);

      // Verify all 8 tiers exist in the lineage string
      expect(chainString).toContain("Tariff: MEGAFLEX");
      expect(chainString).toContain("Version: 2025.1");
      expect(chainString).toContain("Component: ACTIVE_ENERGY_PEAK");
      expect(chainString).toContain("Rule ID: RULE_MEGAFLEX_PEAK_HIGH");
      expect(chainString).toContain("Source: Eskom_Tariff_Booklet_2025_2026.pdf");
      expect(chainString).toContain("Location: p.18 [Megaflex Active Energy TOU Table] row 3 cell Col 4 (High Season Peak)");
      expect(chainString).toContain("Import Run: RUN_20250601_001 via TariffPdfAdapter (confidence 98%)");
      expect(chainString).toContain("Approval: APPROVED by specialist.energy@enera.internal");
    });

    it("preserves the original document bytes without alteration or lossy conversions", async () => {
      const originalCsv =
        "code,name,type,unit,rate,season,period\n" +
        "PEAK,Peak Energy,ENERGY_PEAK,c/kWh,450.25,high,peak\n" +
        "STD,Standard Energy,ENERGY_STANDARD,c/kWh,220.15,high,standard\n";

      const originalBytes = new TextEncoder().encode(originalCsv);

      const reviewPkg = await TariffImportPipeline.importDocument({
        filename: "Official_CoJ_Tariff_2025.csv",
        bytes: originalBytes,
        importedBy: "operator@enera.internal",
      });

      const stored = TariffImportPipeline.getOriginalDocument(reviewPkg.document.document_id);
      expect(stored).toBeDefined();
      expect(stored!.rawBytes).toEqual(originalBytes);
      expect(stored!.sizeBytes).toBe(originalBytes.byteLength);
      expect(stored!.filename).toBe("Official_CoJ_Tariff_2025.csv");
    });
  });

  describe("Requirement 8: Safe Tariff Import Pipeline", () => {
    it("executes the full safe workflow: upload -> store -> register -> extract -> validate -> review gate", async () => {
      const csvData =
        "code,name,type,unit,rate,season,period\n" +
        "PEAK_RATE,Peak Energy Rate,ENERGY_PEAK,c/kWh,375.50,high,peak\n" +
        "DEMAND_RATE,Maximum Demand,DEMAND_CHARGE,R/kVA/month,95.00,all,all\n";
      const bytes = new TextEncoder().encode(csvData);

      // STEP 1 - 9: Import document through pipeline
      const reviewPkg = await TariffImportPipeline.importDocument({
        filename: "CityPower_LPU_Schedule_2025.csv",
        bytes,
        importedBy: "import.agent@enera.internal",
      });

      // Pipeline checks
      expect(reviewPkg.document.filename).toBe("CityPower_LPU_Schedule_2025.csv");
      expect(reviewPkg.validation_result.isValid).toBe(true);
      expect(reviewPkg.candidate_version.header.approval_status).toBe("pending_approval");
      expect(reviewPkg.candidate_version.header.status).toBe("draft");
      expect(reviewPkg.needs_human_review).toBe(true);
      expect(reviewPkg.is_published).toBe(false);

      // Candidate rates have cell provenance attached
      const peakRate = reviewPkg.candidate_version.components.find((c) => c.component_code === "PEAK_RATE");
      expect(peakRate).toBeDefined();
      expect(peakRate!.provenance).toBeDefined();
      expect(peakRate!.provenance.document_location.cell_coordinate).toBe("Line 2");
      expect(peakRate!.provenance.review_and_approval.approval_status).toBe("pending_approval");

      // Verify it is NOT published to production calculations
      const productionCheck = TariffStorageService.getVersionForDate(
        reviewPkg.candidate_version.header.tariff_code,
        reviewPkg.candidate_version.header.effective_date,
      );
      expect(productionCheck).toBeNull();
    });

    it("rejects publication when gazette reference is unverified or approver is missing", async () => {
      const bytes = new TextEncoder().encode("code,name,rate\nR1,Rate 1,100\n");
      const reviewPkg = await TariffImportPipeline.importDocument({
        filename: "Draft_Tariff.csv",
        bytes,
        importedBy: "tester@enera.internal",
      });

      // Attempt approval without verifying official gazette
      await expect(
        TariffImportPipeline.authoriseAndPublish({
          pipelineRunId: reviewPkg.pipeline_run_id,
          approvedBy: "specialist@enera.internal",
          approvalNotes: "Did not check gazette yet",
          gazetteRefVerified: false,
        }),
      ).rejects.toThrowError("Gazette reference must be explicitly verified against official publication");

      // Attempt approval without approver
      await expect(
        TariffImportPipeline.authoriseAndPublish({
          pipelineRunId: reviewPkg.pipeline_run_id,
          approvedBy: "",
          approvalNotes: "Empty approver",
          gazetteRefVerified: true,
        }),
      ).rejects.toThrowError("Approver specialist identifier is mandatory");
    });

    it("publishes tariff version into production only after authorized specialist sign-off", async () => {
      const bytes = new TextEncoder().encode(
        "code,name,type,unit,rate,season,period\n" +
        "COMM_ENERGY,Commercial Energy,ACTIVE_ENERGY,c/kWh,295.00,all,all\n",
      );

      const reviewPkg = await TariffImportPipeline.importDocument({
        filename: "CapeTown_Commercial_2025.csv",
        bytes,
        importedBy: "importer@enera.internal",
      });

      // Authorise and publish
      const published = await TariffImportPipeline.authoriseAndPublish({
        pipelineRunId: reviewPkg.pipeline_run_id,
        approvedBy: "chief.tariff.officer@enera.internal",
        approvalNotes: "Verified against Western Cape Provincial Gazette Extraordinary 8812",
        gazetteRefVerified: true,
      });

      expect(published.header.approval_status).toBe("approved");
      expect(published.header.is_locked).toBe(true);
      expect(published.header.approved_by).toBe("chief.tariff.officer@enera.internal");
      expect(reviewPkg.is_published).toBe(true);

      // Now available for production calculations
      const liveVersion = TariffStorageService.getVersionForDate(
        published.header.tariff_code,
        published.header.effective_date,
      );
      expect(liveVersion).not.toBeNull();
      expect(liveVersion!.header.tariff_code).toBe(published.header.tariff_code);
      expect(liveVersion!.header.is_locked).toBe(true);
    });

    it("rejects unsupported document formats safely", async () => {
      const dummyExe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
      await expect(
        TariffImportPipeline.importDocument({
          filename: "malicious_payload.exe",
          bytes: dummyExe,
          importedBy: "user@test.local",
        }),
      ).rejects.toThrowError("Unsupported tariff document format '.exe'");
    });

    it("flags ambiguous source documents for human review with detailed notes", async () => {
      // Document without explicit year in filename or text
      const ambiguousBytes = new TextEncoder().encode("code,name,rate\nRATE_UNKNOWN,Energy Rate,120.00\n");

      const reviewPkg = await TariffImportPipeline.importDocument({
        filename: "generic_rate_sheet.csv",
        bytes: ambiguousBytes,
        importedBy: "clerk@enera.internal",
      });

      expect(reviewPkg.needs_human_review).toBe(true);
      expect(reviewPkg.extraction_confidence).toBeLessThan(0.9);
      expect(reviewPkg.ambiguity_notes.length).toBeGreaterThan(0);
      expect(reviewPkg.ambiguity_notes[0]).toContain("Effective year could not be detected with 100% certainty");
    });
  });
});
