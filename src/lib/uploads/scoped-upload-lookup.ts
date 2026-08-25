export function buildScopedUploadLookup(uploadId: number, normalizedLocationIds: number[]) {
  return {
    id: uploadId,
    location_id: {
      in: normalizedLocationIds,
    },
    superseded_by: null,
  } as const;
}
