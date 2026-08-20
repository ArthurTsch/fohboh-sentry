import { expect, test } from "@playwright/test";

test("anonymous users are presented with the sign-in boundary", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toContainText(/sign in|login|email/i);
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

test("authenticated critical navigation smoke", async ({ page }) => {
  test.skip(!process.env.E2E_MANAGER_EMAIL || !process.env.E2E_MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD to run the authenticated journey.");
  await page.goto("/");
  await page.getByLabel(/email/i).fill(process.env.E2E_MANAGER_EMAIL!);
  await page.getByRole("textbox", { name: /^password/i }).fill(process.env.E2E_MANAGER_PASSWORD!);
  await page.getByRole("button", { name: /sign in|login/i }).click();
  await expect(page.locator("body")).toContainText(/upload|location|dashboard/i);

  for (const endpoint of ["/api/restaurants", "/api/v1/uploads", "/api/v1/governance/workspaces", "/api/caars"]) {
    const response = await page.request.get(endpoint);
    expect(response.status(), endpoint).toBeLessThan(500);
  }
});
