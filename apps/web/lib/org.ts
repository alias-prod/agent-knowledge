export function getCurrentOrgId(organizationId?: string) {
  if (!organizationId) throw new Error("Select a workspace before accessing its data");
  return organizationId;
}
