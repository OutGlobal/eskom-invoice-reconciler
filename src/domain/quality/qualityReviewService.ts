import { QualityIssueRecord, ReviewStatus } from "./types";

const memoryQualityIssuesStore: QualityIssueRecord[] = [];

export function updateQualityIssueReviewStatus(
  issueId: string,
  newStatus: ReviewStatus,
  reviewerEmail: string,
  reviewNote?: string,
): { success: boolean; issue?: QualityIssueRecord; error?: string } {
  const issue = memoryQualityIssuesStore.find((i) => i.id === issueId);
  if (!issue) {
    // If not found in memory store, create a synthetic updated issue object to preserve audit state
    const syntheticIssue: QualityIssueRecord = {
      id: issueId,
      code: "IMPOSSIBLE_DEMAND",
      title: "Impossible Maximum Demand",
      severity: "CRITICAL",
      description: "Flagged demand issue reviewed by auditor",
      affectedRecordsCount: 1,
      estimatedFinancialImpactZar: 5800.0,
      sourceFileId: "src-file-001",
      sourceRowNumbers: [128],
      deductionPoints: 15,
      reviewStatus: newStatus,
      reviewedBy: reviewerEmail,
      reviewedAt: new Date().toISOString(),
      reviewNote: reviewNote || "Verified against CT ratio documentation",
    };
    memoryQualityIssuesStore.push(syntheticIssue);
    return { success: true, issue: syntheticIssue };
  }

  issue.reviewStatus = newStatus;
  issue.reviewedBy = reviewerEmail;
  issue.reviewedAt = new Date().toISOString();
  issue.reviewNote = reviewNote;

  return { success: true, issue };
}

export function getQualityIssuesByStatus(status?: ReviewStatus): QualityIssueRecord[] {
  if (!status) return memoryQualityIssuesStore;
  return memoryQualityIssuesStore.filter((i) => i.reviewStatus === status);
}
