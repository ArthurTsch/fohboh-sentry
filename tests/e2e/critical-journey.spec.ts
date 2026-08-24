import { expect, test } from "@playwright/test";

test("anonymous users are presented with the sign-in boundary", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toContainText(/sign in|login|email/i);
  const opener = page.getByRole("button", { name: "Request Access", exact: true });
  const openerHandle = await opener.elementHandle();
  await opener.click();
  const dialog = page.getByRole("dialog", { name: /request access/i });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog.locator(":focus")).toHaveCount(1);
  expect(await openerHandle?.evaluate((element) => Boolean(element.closest("[aria-hidden='true']")))).toBe(true);

  const focusable = dialog.locator(
    "a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
  );
  const first = focusable.first();
  const last = focusable.last();
  await last.focus();
  await page.keyboard.press("Tab");
  await expect(first).toBeFocused();
  await first.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(last).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test("private SuperAdmin routes do not expose data anonymously", async ({ page }) => {
  await page.goto("/superadmin/management");
  await expect(page.locator("body")).toContainText(/sign in|login|email/i);
  await expect(page.locator("body")).not.toContainText("Delete all CAAR data");
});

test("sensitive APIs reject anonymous access", async ({ request }) => {
  for (const endpoint of [
    "/api/restaurants",
    "/api/location-states",
    "/api/v1/uploads",
    "/api/v1/governance/workspaces",
    "/api/v1/support/tickets",
  ]) {
    const response = await request.get(endpoint);
    expect([401, 403, 405]).toContain(response.status());
  }
});

test("authenticated critical workflow smoke", async ({ page }) => {
  test.skip(!process.env.E2E_MANAGER_EMAIL || !process.env.E2E_MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD to run the authenticated journey.");
  const login = await page.request.post("/api/auth/login", {
    data: {
      email: process.env.E2E_MANAGER_EMAIL!,
      password: process.env.E2E_MANAGER_PASSWORD!,
    },
  });
  expect(login.status()).toBe(200);
  await page.goto("/");
  await expect(page.locator("body")).toContainText(/upload|location|dashboard/i);

  for (const endpoint of ["/api/restaurants", "/api/v1/activity-log", "/api/v1/uploads", "/api/v1/governance/workspaces", "/api/caars"]) {
    const response = await page.request.get(endpoint);
    expect(response.status(), endpoint).toBeLessThan(500);
  }

  const restaurantsResponse = await page.request.get("/api/restaurants");
  const restaurantsPayload = await restaurantsResponse.json();
  expect(JSON.stringify(restaurantsPayload)).toContain("E2E-LOC-001");

  const missingFile = await page.request.post("/api/v1/uploads", {
    multipart: {
      artifactKey: "m02-dsp-settlement-csv",
      locationId: "E2E-LOC-001",
      moduleId: "M02",
      vendorKey: "uber-eats",
    },
  });
  expect(missingFile.status()).toBe(400);
  await expect(missingFile.json()).resolves.toMatchObject({ error: expect.stringMatching(/file upload/i) });

  const certification = await page.request.post("/api/v1/certifications/run", {
    data: {
      certificationMonth: "2026-06",
      locationId: "E2E-LOC-001",
      modules: ["M02"],
      vendorKey: "uber-eats",
    },
  });
  expect([200, 409]).toContain(certification.status());

  const caars = await page.request.get("/api/caars");
  expect(caars.status()).toBe(200);

});
