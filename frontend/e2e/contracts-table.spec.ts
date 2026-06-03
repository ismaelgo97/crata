import { test, expect } from "./fixtures"
import { allListItems, listItems, CONTRACT_IDS } from "./fixtures/mockData"

test.describe("ContractsTable", () => {
  test.beforeEach(async ({ page, setupMockApi }) => {
    await setupMockApi()
    await page.goto("/")
  })

  // ── Rendering ──────────────────────────────────────────────────────────────

  test("renders a row for every contract in the list", async ({ page }) => {
    for (const item of allListItems) {
      await expect(page.getByText(item.filename)).toBeVisible()
    }
  })

  test("shows the correct status badge for each contract", async ({ page }) => {
    const statusChecks: Array<[string, string]> = [
      [listItems.alquiler_analysed.filename, "analysed"],
      [listItems.pending.filename, "pending"],
      [listItems.unsupported.filename, "unsupported"],
      [listItems.approved.filename, "approved"],
      [listItems.denied.filename, "denied"],
      [listItems.modified.filename, "modified"],
    ]

    for (const [filename, status] of statusChecks) {
      const row = page.locator("tr", { has: page.getByText(filename) })
      await expect(row.getByText(status)).toBeVisible()
    }
  })

  test("shows risk badges for analysed contracts", async ({ page }) => {
    const riskChecks: Array<[string, string]> = [
      [listItems.alquiler_analysed.filename, "medium"],
      [listItems.compraventa_analysed.filename, "high"],
      [listItems.servicios_analysed.filename, "low"],
      [listItems.laboral_analysed.filename, "severe"],
      [listItems.nda_analysed.filename, "low"],
    ]

    for (const [filename, risk] of riskChecks) {
      const row = page.locator("tr", { has: page.getByText(filename) })
      await expect(row.getByText(risk)).toBeVisible()
    }
  })

  test("shows dash for risk when contract is pending or unsupported", async ({
    page,
  }) => {
    const rows = [
      page.locator("tr", { has: page.getByText(listItems.pending.filename) }),
      page.locator("tr", {
        has: page.getByText(listItems.unsupported.filename),
      }),
    ]

    for (const row of rows) {
      // The risk cell should show "—" not a badge
      await expect(row.locator("td").nth(3)).toContainText("—")
    }
  })

  test("shows the contract type for supported contracts", async ({ page }) => {
    const typeChecks: Array<[string, string]> = [
      [listItems.alquiler_analysed.filename, "alquiler"],
      [listItems.compraventa_analysed.filename, "compraventa"],
      [listItems.servicios_analysed.filename, "servicios"],
      [listItems.laboral_analysed.filename, "laboral"],
      [listItems.nda_analysed.filename, "nda"],
    ]

    for (const [filename, type] of typeChecks) {
      const row = page.locator("tr", { has: page.getByText(filename) })
      await expect(row.getByText(type)).toBeVisible()
    }
  })

  // ── Empty & error states ───────────────────────────────────────────────────

  test("shows empty state when no contracts are returned", async ({
    page,
    setupMockApi,
  }) => {
    await setupMockApi({ listItems: [] })
    await page.goto("/")
    await expect(page.getByText("No contracts found.")).toBeVisible()
  })

  test("shows error message when list endpoint fails", async ({
    page,
    setupMockApi,
  }) => {
    await setupMockApi({ listError: true })
    await page.goto("/")
    await expect(page.getByText(/Failed to load contracts/)).toBeVisible()
  })

  // ── Refresh ────────────────────────────────────────────────────────────────

  test("refresh button reloads contracts", async ({ page }) => {
    let callCount = 0
    page.on("request", (req) => {
      if (req.url().includes("/api/v1/contracts/") && req.method() === "GET") {
        callCount++
      }
    })

    await page.getByRole("button", { name: "Refresh" }).click()
    await page.waitForTimeout(300)
    expect(callCount).toBeGreaterThanOrEqual(1)
  })

  // ── View button ────────────────────────────────────────────────────────────

  test("clicking View opens the modal for that contract", async ({ page }) => {
    const row = page.locator("tr", {
      has: page.getByText(listItems.alquiler_analysed.filename),
    })
    await row.getByRole("button", { name: "View" }).click()
    // Modal should appear with the contract filename
    await expect(
      page.getByText(listItems.alquiler_analysed.filename),
    ).toHaveCount(2) // once in table, once in modal header
  })

  // ── Upload ─────────────────────────────────────────────────────────────────

  test("upload button is disabled without a username", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: "Upload contract" }),
    ).toBeDisabled()
  })

  test("upload button is enabled after setting a username", async ({
    page,
  }) => {
    await page.getByPlaceholder("Enter username…").fill("user_test")
    await page.getByRole("button", { name: "Set user" }).click()
    await expect(
      page.getByRole("button", { name: "Upload contract" }),
    ).toBeEnabled()
  })

  // ── Per-type visual smoke tests ────────────────────────────────────────────

  test.describe("contract type rows are all visible", () => {
    const contractRows: Array<[string, string]> = [
      ["alquiler", CONTRACT_IDS.alquiler],
      ["compraventa", CONTRACT_IDS.compraventa],
      ["servicios", CONTRACT_IDS.servicios],
      ["laboral", CONTRACT_IDS.laboral],
      ["nda", CONTRACT_IDS.nda],
      ["unsupported", CONTRACT_IDS.unsupported],
    ]

    for (const [type] of contractRows) {
      test(`shows ${type} row`, async ({ page }) => {
        await expect(page.getByText(type)).toBeVisible()
      })
    }
  })
})
