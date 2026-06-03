import { test as base, type Page, type Route } from "@playwright/test"
import {
  allListItems,
  detailResponses,
  actionResponses,
  makeUploadResponse,
  type MockListItem,
  type MockDetail,
} from "./mockData"

const API = "http://127.0.0.1:8000/api/v1/contracts"

// ---------------------------------------------------------------------------
// Route helper types
// ---------------------------------------------------------------------------

interface MockApiOptions {
  /** Override the contracts returned by GET /contracts/. Defaults to allListItems. */
  listItems?: MockListItem[]
  /**
   * Override the detail returned for a specific contract ID.
   * Falls back to detailResponses[id] then a 404.
   */
  detailOverrides?: Record<string, MockDetail>
  /** If true, GET /contracts/ returns HTTP 500. */
  listError?: boolean
}

// ---------------------------------------------------------------------------
// Low-level route helpers (usable standalone inside a test)
// ---------------------------------------------------------------------------

/** Wire GET /contracts/ */
export async function mockListRoute(
  page: Page,
  items: MockListItem[] = allListItems,
) {
  await page.route(`${API}/`, (route: Route) => {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(items) })
  })
}

/** Wire GET /contracts/:id?include_history=... */
export async function mockDetailRoute(
  page: Page,
  overrides: Record<string, MockDetail> = {},
) {
  await page.route(`${API}/**`, async (route: Route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()

    // Only handle GET here; POST routes are handled separately
    if (method !== "GET") {
      await route.fallback()
      return
    }

    // Extract contract ID from path: /api/v1/contracts/<id>
    const pathParts = url.pathname.replace(/\/$/, "").split("/")
    const id = pathParts[pathParts.length - 1]

    const detail = overrides[id] ?? detailResponses[id]
    if (!detail) {
      route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Not found" }) })
      return
    }

    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(detail) })
  })
}

/** Wire POST /contracts/:id/approve|deny|modify */
export async function mockActionRoutes(page: Page) {
  for (const action of ["approve", "deny", "modify"] as const) {
    await page.route(`${API}/**/${action}`, (route: Route) => {
      const url = new URL(route.request().url())
      const parts = url.pathname.split("/")
      const contractId = parts[parts.length - 2]
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(actionResponses[action](contractId)),
      })
    })
  }
}

/** Wire POST /contracts/upload */
export async function mockUploadRoute(page: Page, filename = "test.txt") {
  await page.route(`${API}/upload`, (route: Route) => {
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(makeUploadResponse(filename)),
    })
  })
}

// ---------------------------------------------------------------------------
// Composite helper — sets up all routes at once
// ---------------------------------------------------------------------------

export async function mockApi(page: Page, options: MockApiOptions = {}) {
  const { listItems = allListItems, detailOverrides = {}, listError = false } = options

  await page.route(`${API}/`, (route: Route) => {
    if (listError) {
      route.fulfill({ status: 500, body: "Internal Server Error" })
      return
    }
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(listItems) })
  })

  await mockDetailRoute(page, detailOverrides)
  await mockActionRoutes(page)
  await mockUploadRoute(page)
}

// ---------------------------------------------------------------------------
// Custom Playwright fixture
// ---------------------------------------------------------------------------

interface Fixtures {
  /**
   * `mockApi` is pre-wired for you. Call it inside the test body before
   * navigating if you need to customise which contracts are shown.
   *
   * @example
   * test('shows only pending', async ({ page, setupMockApi }) => {
   *   await setupMockApi({ listItems: [listItems.pending] })
   *   await page.goto('/')
   * })
   */
  setupMockApi: (options?: MockApiOptions) => Promise<void>
}

export const test = base.extend<Fixtures>({
  setupMockApi: async ({ page }, use) => {
    await use((options) => mockApi(page, options))
  },
})

export { expect } from "@playwright/test"
