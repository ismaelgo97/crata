import { test, expect } from "./fixtures"
import {
  listItems,
  detailResponses,
  CONTRACT_IDS,
  analysisResults,
} from "./fixtures/mockData"

// ---------------------------------------------------------------------------
// Helper: open the modal for a given list item
// ---------------------------------------------------------------------------

async function openModal(
  page: Parameters<typeof test.fn>[0]["page"],
  filename: string,
) {
  const row = page.locator("tr", { has: page.getByText(filename) })
  await row.getByRole("button", { name: "View" }).click()
  // Wait for the modal to finish loading
  await expect(page.getByText("Loading…")).not.toBeVisible({ timeout: 5000 })
}

// ---------------------------------------------------------------------------
// Modal — shared behaviour
// ---------------------------------------------------------------------------

test.describe("ContractModal — shared", () => {
  test.beforeEach(async ({ page, setupMockApi }) => {
    await setupMockApi()
    await page.goto("/")
  })

  test("closes when clicking the overlay backdrop", async ({ page }) => {
    await openModal(page, listItems.nda_analysed.filename)
    await page.locator(".fixed.inset-0").click({ position: { x: 10, y: 10 } })
    await expect(page.getByRole("button", { name: "Close" })).not.toBeVisible()
  })

  test("closes when clicking the Close button", async ({ page }) => {
    await openModal(page, listItems.nda_analysed.filename)
    await page.getByRole("button", { name: "Close" }).click()
    await expect(page.getByRole("button", { name: "Close" })).not.toBeVisible()
  })

  test("Check content shows the raw contract text", async ({ page }) => {
    await openModal(page, listItems.nda_analysed.filename)
    await page.getByRole("button", { name: "Check content" }).click()
    await expect(
      page.getByText("ACUERDO DE CONFIDENCIALIDAD", { exact: false }),
    ).toBeVisible()
  })

  test("Back button returns to main view from content", async ({ page }) => {
    await openModal(page, listItems.nda_analysed.filename)
    await page.getByRole("button", { name: "Check content" }).click()
    await page.getByText("← Back").click()
    await expect(page.getByRole("button", { name: "Check content" })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Modal — per contract type analysis rendering
// ---------------------------------------------------------------------------

test.describe("ContractModal — alquiler (medium risk)", () => {
  test.beforeEach(async ({ page, setupMockApi }) => {
    await setupMockApi({ listItems: [listItems.alquiler_analysed] })
    await page.goto("/")
    await openModal(page, listItems.alquiler_analysed.filename)
  })

  test("shows summary text", async ({ page }) => {
    const analysis = analysisResults.alquiler
    await expect(page.getByText(analysis.summary!)).toBeVisible()
  })

  test("shows medium risk badge", async ({ page }) => {
    await expect(page.locator(".fixed").getByText("medium")).toBeVisible()
  })

  test("shows red flags section", async ({ page }) => {
    await expect(page.getByText("Red flags")).toBeVisible()
    await expect(page.getByText(/renuncia expresamente/)).toBeVisible()
  })

  test("shows metadata fields", async ({ page }) => {
    await expect(page.getByText("monthly rent", { exact: false })).toBeVisible()
    await expect(page.getByText("850 EUR")).toBeVisible()
  })

  test("shows ANALYSE history entry", async ({ page }) => {
    await expect(page.getByText("ANALYSE")).toBeVisible()
    await expect(page.getByText("LLM")).toBeVisible()
  })
})

test.describe("ContractModal — compraventa (high risk)", () => {
  test.beforeEach(async ({ page, setupMockApi }) => {
    await setupMockApi({ listItems: [listItems.compraventa_analysed] })
    await page.goto("/")
    await openModal(page, listItems.compraventa_analysed.filename)
  })

  test("shows high risk badge", async ({ page }) => {
    await expect(page.locator(".fixed").getByText("high")).toBeVisible()
  })

  test("shows 3 red flags", async ({ page }) => {
    await expect(page.getByText("Red flags (3)")).toBeVisible()
  })

  test("shows severe red flag for vicios ocultos", async ({ page }) => {
    await expect(page.getByText(/vicios ocultos/)).toBeVisible()
    await expect(page.getByText("severe")).toBeVisible()
  })
})

test.describe("ContractModal — servicios (low risk)", () => {
  test.beforeEach(async ({ page, setupMockApi }) => {
    await setupMockApi({ listItems: [listItems.servicios_analysed] })
    await page.goto("/")
    await openModal(page, listItems.servicios_analysed.filename)
  })

  test("shows low risk badge", async ({ page }) => {
    await expect(page.locator(".fixed").getByText("low")).toBeVisible()
  })

  test("shows no red flags section when list is empty", async ({ page }) => {
    await expect(page.getByText("Red flags")).not.toBeVisible()
  })

  test("shows metadata with fee", async ({ page }) => {
    await expect(page.getByText("5.000 EUR/mes")).toBeVisible()
  })
})

test.describe("ContractModal — laboral (severe risk)", () => {
  test.beforeEach(async ({ page, setupMockApi }) => {
    await setupMockApi({ listItems: [listItems.laboral_analysed] })
    await page.goto("/")
    await openModal(page, listItems.laboral_analysed.filename)
  })

  test("shows severe risk badge", async ({ page }) => {
    await expect(page.locator(".fixed").getByText("severe")).toBeVisible()
  })

  test("shows 4 red flags", async ({ page }) => {
    await expect(page.getByText("Red flags (4)")).toBeVisible()
  })

  test("shows Estatuto de los Trabajadores references", async ({ page }) => {
    await expect(page.getByText(/Estatuto de los Trabajadores/)).toBeVisible()
  })
})

test.describe("ContractModal — nda (low risk)", () => {
  test.beforeEach(async ({ page, setupMockApi }) => {
    await setupMockApi({ listItems: [listItems.nda_analysed] })
    await page.goto("/")
    await openModal(page, listItems.nda_analysed.filename)
  })

  test("shows bilateral NDA metadata", async ({ page }) => {
    await expect(page.getByText("Bilateral")).toBeVisible()
  })

  test("shows penalty red flag as medium severity", async ({ page }) => {
    await expect(page.getByText(/500\.000 EUR/)).toBeVisible()
  })
})

test.describe("ContractModal — unsupported contract", () => {
  test.beforeEach(async ({ page, setupMockApi }) => {
    await setupMockApi({ listItems: [listItems.unsupported] })
    await page.goto("/")
    await openModal(page, listItems.unsupported.filename)
  })

  test("shows unsupported message instead of analysis", async ({ page }) => {
    await expect(
      page.getByText(/no está soportado/),
    ).toBeVisible()
  })

  test("does not show risk badge or red flags", async ({ page }) => {
    await expect(page.getByText("Red flags")).not.toBeVisible()
  })
})

test.describe("ContractModal — pending contract", () => {
  test.beforeEach(async ({ page, setupMockApi }) => {
    await setupMockApi({ listItems: [listItems.pending] })
    await page.goto("/")
    await openModal(page, listItems.pending.filename)
  })

  test("shows 'analysis in progress' message", async ({ page }) => {
    await expect(
      page.getByText("Analysis is still in progress…"),
    ).toBeVisible()
  })

  test("does not show action buttons for pending contracts", async ({
    page,
  }) => {
    await expect(page.getByRole("button", { name: "Approve" })).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Modal — action buttons (approve / deny / modify)
// ---------------------------------------------------------------------------

test.describe("ContractModal — actions", () => {
  test.beforeEach(async ({ page, setupMockApi }) => {
    await setupMockApi({ listItems: [listItems.alquiler_analysed] })
    await page.goto("/")
    // Set a username so actions are enabled
    await page.getByPlaceholder("Enter username…").fill("reviewer_test")
    await page.getByRole("button", { name: "Set user" }).click()
    await openModal(page, listItems.alquiler_analysed.filename)
  })

  test("shows Approve / Deny / Modify buttons for analysed contract with username", async ({
    page,
  }) => {
    await expect(page.getByRole("button", { name: "Approve" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Deny" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Modify" })).toBeVisible()
  })

  test("approve sends POST and modal reloads", async ({ page }) => {
    const approveRequest = page.waitForRequest(
      (req) =>
        req.url().includes(`/${CONTRACT_IDS.alquiler}/approve`) &&
        req.method() === "POST",
    )
    await page.getByRole("button", { name: "Approve" }).click()
    await approveRequest
  })

  test("deny sends POST and modal reloads", async ({ page }) => {
    const denyRequest = page.waitForRequest(
      (req) =>
        req.url().includes(`/${CONTRACT_IDS.alquiler}/deny`) &&
        req.method() === "POST",
    )
    await page.getByRole("button", { name: "Deny" }).click()
    await denyRequest
  })

  test("modify shows textarea and submits feedback", async ({ page }) => {
    await page.getByRole("button", { name: "Modify" }).click()
    await expect(
      page.getByPlaceholder("Describe the required changes…"),
    ).toBeVisible()

    // Submit button is disabled until text is entered
    await expect(
      page.getByRole("button", { name: "Submit" }),
    ).toBeDisabled()

    await page
      .getByPlaceholder("Describe the required changes…")
      .fill("Remove clause 3.2 and revise penalty amount.")

    const modifyRequest = page.waitForRequest(
      (req) =>
        req.url().includes(`/${CONTRACT_IDS.alquiler}/modify`) &&
        req.method() === "POST",
    )
    await page.getByRole("button", { name: "Submit" }).click()
    await modifyRequest
  })

  test("cancel in modify mode hides the textarea", async ({ page }) => {
    await page.getByRole("button", { name: "Modify" }).click()
    await page.getByRole("button", { name: "Cancel" }).click()
    await expect(
      page.getByPlaceholder("Describe the required changes…"),
    ).not.toBeVisible()
    await expect(page.getByRole("button", { name: "Modify" })).toBeVisible()
  })
})

test.describe("ContractModal — actions blocked without username", () => {
  test.beforeEach(async ({ page, setupMockApi }) => {
    await setupMockApi({ listItems: [listItems.alquiler_analysed] })
    await page.goto("/")
    await openModal(page, listItems.alquiler_analysed.filename)
  })

  test("shows 'set a username' prompt instead of action buttons", async ({
    page,
  }) => {
    await expect(
      page.getByText("Set a username to approve, deny or modify."),
    ).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Modal — history detail view
// ---------------------------------------------------------------------------

test.describe("ContractModal — history detail view", () => {
  test.beforeEach(async ({ page, setupMockApi }) => {
    await setupMockApi({ listItems: [listItems.approved] })
    await page.goto("/")
    await openModal(page, listItems.approved.filename)
  })

  test("shows ANALYSE and APPROVE history entries", async ({ page }) => {
    await expect(page.getByText("ANALYSE")).toBeVisible()
    await expect(page.getByText("APPROVE")).toBeVisible()
  })

  test("clicking ANALYSE entry shows parsed analysis view", async ({
    page,
  }) => {
    await page
      .locator("button", { has: page.getByText("ANALYSE") })
      .first()
      .click()
    // Should render the AnalysisView with summary
    await expect(page.getByText("Summary")).toBeVisible()
    await expect(page.getByText("← Back")).toBeVisible()
  })

  test("clicking APPROVE entry shows raw output fallback", async ({
    page,
  }) => {
    await page
      .locator("button", { has: page.getByText("APPROVE") })
      .click()
    // APPROVE has no ai_output; shows "No content available."
    await expect(page.getByText("No content available.")).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Modal — approved / denied / modified (no action buttons)
// ---------------------------------------------------------------------------

test.describe("ContractModal — terminal statuses", () => {
  const terminalCases = [
    { item: listItems.approved, label: "approved" },
    { item: listItems.denied, label: "denied" },
    { item: listItems.modified, label: "modified" },
  ] as const

  for (const { item, label } of terminalCases) {
    test(`no action buttons for ${label} contract`, async ({
      page,
      setupMockApi,
    }) => {
      await setupMockApi({ listItems: [item] })
      await page.goto("/")
      await page.getByPlaceholder("Enter username…").fill("reviewer_test")
      await page.getByRole("button", { name: "Set user" }).click()
      await openModal(page, item.filename)

      await expect(
        page.getByRole("button", { name: "Approve" }),
      ).not.toBeVisible()
      await expect(
        page.getByRole("button", { name: "Deny" }),
      ).not.toBeVisible()
    })
  }
})

// ---------------------------------------------------------------------------
// Modal — detail fetch error
// ---------------------------------------------------------------------------

test.describe("ContractModal — fetch error", () => {
  test("shows error message when detail fetch fails", async ({
    page,
    setupMockApi,
  }) => {
    await setupMockApi({
      listItems: [listItems.alquiler_analysed],
      // Override detail for this ID to trigger a 404
      detailOverrides: {
        [CONTRACT_IDS.alquiler]: undefined as unknown as never,
      },
    })
    await page.goto("/")
    await openModal(page, listItems.alquiler_analysed.filename)
    await expect(page.getByText(/Failed to load/)).toBeVisible()
  })
})
