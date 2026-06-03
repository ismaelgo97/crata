# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: contract-modal.spec.ts >> ContractModal — compraventa (high risk) >> shows severe red flag for vicios ocultos
- Location: e2e/contract-modal.spec.ts:112:3

# Error details

```
Error: locator.click: Test ended.
Call log:
  - waiting for locator('tr').filter({ has: getByText('compraventa_piso_mayor.txt') }).getByRole('button', { name: 'View' })

```

# Test source

```ts
  1   | import { test, expect } from "./fixtures"
  2   | import {
  3   |   listItems,
  4   |   detailResponses,
  5   |   CONTRACT_IDS,
  6   |   analysisResults,
  7   | } from "./fixtures/mockData"
  8   | 
  9   | // ---------------------------------------------------------------------------
  10  | // Helper: open the modal for a given list item
  11  | // ---------------------------------------------------------------------------
  12  | 
  13  | async function openModal(
  14  |   page: Parameters<typeof test.fn>[0]["page"],
  15  |   filename: string,
  16  | ) {
  17  |   const row = page.locator("tr", { has: page.getByText(filename) })
> 18  |   await row.getByRole("button", { name: "View" }).click()
      |                                                   ^ Error: locator.click: Test ended.
  19  |   // Wait for the modal to finish loading
  20  |   await expect(page.getByText("Loading…")).not.toBeVisible({ timeout: 5000 })
  21  | }
  22  | 
  23  | // ---------------------------------------------------------------------------
  24  | // Modal — shared behaviour
  25  | // ---------------------------------------------------------------------------
  26  | 
  27  | test.describe("ContractModal — shared", () => {
  28  |   test.beforeEach(async ({ page, setupMockApi }) => {
  29  |     await setupMockApi()
  30  |     await page.goto("/")
  31  |   })
  32  | 
  33  |   test("closes when clicking the overlay backdrop", async ({ page }) => {
  34  |     await openModal(page, listItems.nda_analysed.filename)
  35  |     await page.locator(".fixed.inset-0").click({ position: { x: 10, y: 10 } })
  36  |     await expect(page.getByRole("button", { name: "Close" })).not.toBeVisible()
  37  |   })
  38  | 
  39  |   test("closes when clicking the Close button", async ({ page }) => {
  40  |     await openModal(page, listItems.nda_analysed.filename)
  41  |     await page.getByRole("button", { name: "Close" }).click()
  42  |     await expect(page.getByRole("button", { name: "Close" })).not.toBeVisible()
  43  |   })
  44  | 
  45  |   test("Check content shows the raw contract text", async ({ page }) => {
  46  |     await openModal(page, listItems.nda_analysed.filename)
  47  |     await page.getByRole("button", { name: "Check content" }).click()
  48  |     await expect(
  49  |       page.getByText("ACUERDO DE CONFIDENCIALIDAD", { exact: false }),
  50  |     ).toBeVisible()
  51  |   })
  52  | 
  53  |   test("Back button returns to main view from content", async ({ page }) => {
  54  |     await openModal(page, listItems.nda_analysed.filename)
  55  |     await page.getByRole("button", { name: "Check content" }).click()
  56  |     await page.getByText("← Back").click()
  57  |     await expect(page.getByRole("button", { name: "Check content" })).toBeVisible()
  58  |   })
  59  | })
  60  | 
  61  | // ---------------------------------------------------------------------------
  62  | // Modal — per contract type analysis rendering
  63  | // ---------------------------------------------------------------------------
  64  | 
  65  | test.describe("ContractModal — alquiler (medium risk)", () => {
  66  |   test.beforeEach(async ({ page, setupMockApi }) => {
  67  |     await setupMockApi({ listItems: [listItems.alquiler_analysed] })
  68  |     await page.goto("/")
  69  |     await openModal(page, listItems.alquiler_analysed.filename)
  70  |   })
  71  | 
  72  |   test("shows summary text", async ({ page }) => {
  73  |     const analysis = analysisResults.alquiler
  74  |     await expect(page.getByText(analysis.summary!)).toBeVisible()
  75  |   })
  76  | 
  77  |   test("shows medium risk badge", async ({ page }) => {
  78  |     await expect(page.locator(".fixed").getByText("medium")).toBeVisible()
  79  |   })
  80  | 
  81  |   test("shows red flags section", async ({ page }) => {
  82  |     await expect(page.getByText("Red flags")).toBeVisible()
  83  |     await expect(page.getByText(/renuncia expresamente/)).toBeVisible()
  84  |   })
  85  | 
  86  |   test("shows metadata fields", async ({ page }) => {
  87  |     await expect(page.getByText("monthly rent", { exact: false })).toBeVisible()
  88  |     await expect(page.getByText("850 EUR")).toBeVisible()
  89  |   })
  90  | 
  91  |   test("shows ANALYSE history entry", async ({ page }) => {
  92  |     await expect(page.getByText("ANALYSE")).toBeVisible()
  93  |     await expect(page.getByText("LLM")).toBeVisible()
  94  |   })
  95  | })
  96  | 
  97  | test.describe("ContractModal — compraventa (high risk)", () => {
  98  |   test.beforeEach(async ({ page, setupMockApi }) => {
  99  |     await setupMockApi({ listItems: [listItems.compraventa_analysed] })
  100 |     await page.goto("/")
  101 |     await openModal(page, listItems.compraventa_analysed.filename)
  102 |   })
  103 | 
  104 |   test("shows high risk badge", async ({ page }) => {
  105 |     await expect(page.locator(".fixed").getByText("high")).toBeVisible()
  106 |   })
  107 | 
  108 |   test("shows 3 red flags", async ({ page }) => {
  109 |     await expect(page.getByText("Red flags (3)")).toBeVisible()
  110 |   })
  111 | 
  112 |   test("shows severe red flag for vicios ocultos", async ({ page }) => {
  113 |     await expect(page.getByText(/vicios ocultos/)).toBeVisible()
  114 |     await expect(page.getByText("severe")).toBeVisible()
  115 |   })
  116 | })
  117 | 
  118 | test.describe("ContractModal — servicios (low risk)", () => {
```