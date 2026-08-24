export function buildCertificationUploadLookup(normalizedLocationId: number) {
  return {
    location_id: normalizedLocationId,
    superseded_by: null,
  } as const;
}
