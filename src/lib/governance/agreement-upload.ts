export function buildAgreementUploadLookup({
  artifactKey,
  moduleId,
  normalizedLocationId,
}: {
  artifactKey: string;
  moduleId: "M01" | "M02";
  normalizedLocationId: number;
}) {
  return {
    artifact_key: artifactKey,
    location_id: normalizedLocationId,
    module: moduleId,
    superseded_by: null,
  } as const;
}

export function matchesAgreementUploadVendor(
  uploadVendor: string | null,
  vendorCandidates: string[],
) {
  const normalizedUploadVendor = uploadVendor?.trim().toLowerCase();
  return Boolean(
    normalizedUploadVendor &&
      vendorCandidates.some((candidate) => candidate.trim().toLowerCase() === normalizedUploadVendor),
  );
}
