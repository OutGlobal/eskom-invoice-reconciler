let workspaceScope: string | null = null;

export function setWorkspaceScope(userId: string, organisationId: string): void {
  workspaceScope = `${encodeURIComponent(organisationId)}_${encodeURIComponent(userId)}`;
}
export function clearWorkspaceScope(): void {
  workspaceScope = null;
}
export function scopedDatabaseName(base: string): string {
  if (!workspaceScope) throw new Error("Authenticated workspace required");
  return `${base}_${workspaceScope}`;
}
