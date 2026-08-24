import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const modalSources = [
  "src/app/superadmin/access-requests/page.tsx",
  "src/components/sentry/overlays/AddLocationModal.tsx",
  "src/components/sentry/overlays/ArtifactWorkflowModal.tsx",
  "src/components/sentry/overlays/CaarReportModal.tsx",
  "src/components/sentry/overlays/CertificationCadenceModal.tsx",
  "src/components/sentry/overlays/CertificationProgressModal.tsx",
  "src/components/sentry/overlays/CertificationRunModal.tsx",
  "src/components/sentry/overlays/LocationSourceSettingsModal.tsx",
  "src/components/sentry/overlays/RequestAccessModal.tsx",
  "src/components/sentry/overlays/SchemaEditorModal.tsx",
  "src/components/sentry/overlays/UploadChecklistModal.tsx",
  "src/components/sentry/overlays/WgsOnboardingWizard.tsx",
  "src/components/sentry/overlays/WgsUserModal.tsx",
  "src/components/sentry/overlays/WorkflowBlockerModal.tsx",
  "src/components/sentry/views/PermissionsView.tsx",
  "src/components/sentry/views/UploadCenterView.tsx",
];

describe("accessible dialog coverage", () => {
  it.each(modalSources)("uses the shared named dialog boundary in %s", (sourcePath) => {
    const source = readFileSync(resolve(sourcePath), "utf8");
    const boundaries = source.match(/<AccessibleDialog\b[^>]*>/g) ?? [];
    expect(boundaries.length).toBeGreaterThan(0);
    for (const boundary of boundaries) {
      expect(boundary).toMatch(/ariaLabel=|aria-labelledby=/);
    }
  });
});
