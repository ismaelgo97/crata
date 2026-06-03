import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import type { Contract } from "@/components/ContractsTable"

const API_BASE = "http://127.0.0.1:8000/api/v1/contracts"

// ─── Types ────────────────────────────────────────────────────────────────────

interface RedFlag {
  clause_quote: string
  issue: string
  law_reference: string
  severity: string
}

interface AnalysisResult {
  unsupported?: boolean
  message?: string
  contract_type?: string
  summary?: string
  overall_risk?: string
  metadata?: Record<string, unknown>
  red_flags?: RedFlag[]
}

interface HistoryEntry {
  id: string
  action: string | null
  username: string | null
  user_feedback: string | null
  ai_output: string | null
  created_at: string | null
}

interface ContractDetail extends Contract {
  analysis_result: string | null
  history: HistoryEntry[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  low:    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  high:   "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  severe: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

function Badge({ label, style }: { label: string; style?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style ?? "bg-muted text-muted-foreground"}`}>
      {label}
    </span>
  )
}

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <span className="text-base">←</span> Back
    </button>
  )
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

function ContentView({ content, onBack }: { content: string; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <BackButton onClick={onBack} />
      <pre className="whitespace-pre-wrap text-xs font-mono bg-muted rounded-md p-4 max-h-[60vh] overflow-y-auto leading-relaxed">
        {content}
      </pre>
    </div>
  )
}

function HistoryDetailView({
  entry,
  onBack,
}: {
  entry: HistoryEntry
  onBack: () => void
}) {
  const text = entry.action === "ANALYSE"
    ? entry.ai_output
    : entry.user_feedback

  let parsed: AnalysisResult | null = null
  if (entry.action === "ANALYSE" && entry.ai_output) {
    try { parsed = JSON.parse(entry.ai_output) } catch { /* raw fallback */ }
  }

  return (
    <div className="flex flex-col gap-4">
      <BackButton onClick={onBack} />
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">{entry.action}</span>
        <span className="text-muted-foreground">by {entry.username ?? "—"}</span>
        <span className="text-muted-foreground ml-auto">{formatDate(entry.created_at)}</span>
      </div>

      {parsed ? (
        <AnalysisView analysis={parsed} />
      ) : (
        <pre className="whitespace-pre-wrap text-xs font-mono bg-muted rounded-md p-4 max-h-[60vh] overflow-y-auto">
          {text ?? "No content available."}
        </pre>
      )}
    </div>
  )
}

// ─── Analysis display ─────────────────────────────────────────────────────────

function MetadataTable({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata).filter(
    ([k, v]) => k !== "contract_type" && v !== null && v !== undefined
  )
  if (entries.length === 0) return null
  return (
    <div className="flex flex-col gap-1">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-2 text-sm">
          <span className="text-muted-foreground min-w-[160px] capitalize">{key.replace(/_/g, " ")}</span>
          <span className="font-medium break-all">
            {Array.isArray(value) ? value.join(", ") : String(value)}
          </span>
        </div>
      ))}
    </div>
  )
}

function AnalysisView({ analysis }: { analysis: AnalysisResult }) {
  if (analysis.unsupported) {
    return (
      <p className="text-sm text-muted-foreground">{analysis.message ?? "Unsupported contract type."}</p>
    )
  }

  return (
    <div className="flex flex-col gap-5 overflow-y-auto max-h-[60vh] pr-1">

      {/* Summary */}
      {analysis.summary && (
        <section className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">Summary</h4>
            {analysis.overall_risk && (
              <Badge
                label={analysis.overall_risk}
                style={SEVERITY_STYLES[analysis.overall_risk]}
              />
            )}
          </div>
          <p className="text-sm leading-relaxed">{analysis.summary}</p>
        </section>
      )}

      {/* Metadata */}
      {analysis.metadata && Object.keys(analysis.metadata).length > 0 && (
        <section className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold">Metadata</h4>
          <MetadataTable metadata={analysis.metadata} />
        </section>
      )}

      {/* Red flags */}
      {analysis.red_flags && analysis.red_flags.length > 0 && (
        <section className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold">
            Red flags{" "}
            <span className="text-muted-foreground font-normal">({analysis.red_flags.length})</span>
          </h4>
          <div className="flex flex-col gap-3">
            {analysis.red_flags.map((flag, i) => (
              <div key={i} className="rounded-md border p-3 flex flex-col gap-1.5 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <blockquote className="italic text-muted-foreground text-xs leading-relaxed flex-1">
                    "{flag.clause_quote}"
                  </blockquote>
                  <Badge
                    label={flag.severity}
                    style={SEVERITY_STYLES[flag.severity]}
                  />
                </div>
                <p>{flag.issue}</p>
                <p className="text-xs text-muted-foreground">{flag.law_reference}</p>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}

// ─── Action buttons ───────────────────────────────────────────────────────────

function ActionButtons({
  contractId,
  username,
  onActionDone,
}: {
  contractId: string
  username: string
  onActionDone: () => void
}) {
  const [modifyMode, setModifyMode] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const post = async (action: "approve" | "deny" | "modify") => {
    setSubmitting(true)
    setActionError(null)
    try {
      const body: Record<string, string> = { username }
      if (action === "modify") body.feedback = feedback
      const res = await fetch(`${API_BASE}/${contractId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail ?? `Error ${res.status}`)
      }
      setModifyMode(false)
      setFeedback("")
      onActionDone()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 flex-1">
      {modifyMode && (
        <>
          <textarea
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            rows={2}
            placeholder="Describe the required changes…"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            autoFocus
          />
          {actionError && <p className="text-xs text-destructive">{actionError}</p>}
        </>
      )}
      <div className="flex items-center gap-2">
        {modifyMode ? (
          <>
            <Button
              size="sm"
              disabled={submitting || !feedback.trim()}
              onClick={() => post("modify")}
            >
              {submitting ? "Submitting…" : "Submit"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={submitting}
              onClick={() => { setModifyMode(false); setFeedback(""); setActionError(null) }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              disabled={submitting}
              onClick={() => post("approve")}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {submitting ? "…" : "Approve"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={submitting}
              onClick={() => post("deny")}
            >
              {submitting ? "…" : "Deny"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={submitting}
              onClick={() => setModifyMode(true)}
            >
              Modify
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

function MainView({
  detail,
  username,
  onCheckContent,
  onViewHistory,
  onActionDone,
}: {
  detail: ContractDetail
  username: string | null
  onCheckContent: () => void
  onViewHistory: (entry: HistoryEntry) => void
  onActionDone: () => void
}) {
  let analysis: AnalysisResult | null = null
  if (detail.analysis_result) {
    try { analysis = JSON.parse(detail.analysis_result) } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col gap-5 overflow-y-auto max-h-[70vh] pr-1">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-base">{detail.filename}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {detail.contract_type ?? "Unknown type"} · {detail.status}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onCheckContent}>
          Check content
        </Button>
      </div>

      {/* Analysis */}
      {analysis ? (
        <AnalysisView analysis={analysis} />
      ) : (
        <p className="text-sm text-muted-foreground">
          {detail.status === "pending"
            ? "Analysis is still in progress…"
            : "No analysis available."}
        </p>
      )}

      {/* History */}
      {detail.history && detail.history.length > 0 && (
        <section className="flex flex-col gap-2 border-t pt-4">
          <h4 className="text-sm font-semibold">History</h4>
          <div className="flex flex-col gap-1">
            {detail.history.map((entry) => (
              <button
                key={entry.id}
                onClick={() => onViewHistory(entry)}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{entry.action ?? "—"}</span>
                  <span className="text-muted-foreground">{entry.username ?? "—"}</span>
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(entry.created_at)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}

// ─── Modal root ───────────────────────────────────────────────────────────────

type View =
  | { type: "main" }
  | { type: "content" }
  | { type: "history-detail"; entry: HistoryEntry }

interface Props {
  contract: Contract
  username: string | null
  onClose: () => void
  onContractUpdated?: () => void
}

export function ContractModal({ contract, username, onClose, onContractUpdated }: Props) {
  const [detail, setDetail] = useState<ContractDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>({ type: "main" })

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/${contract.contract_id}?include_history=true`)
      if (!res.ok) throw new Error(`Error ${res.status}`)
      setDetail(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [contract.contract_id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background rounded-lg p-6 w-full max-w-2xl shadow-lg flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && <p className="text-sm text-destructive">Failed to load: {error}</p>}

        {detail && (
          <>
            {view.type === "main" && (
              <MainView
                detail={detail}
                username={username}
                onCheckContent={() => setView({ type: "content" })}
                onViewHistory={(entry) => setView({ type: "history-detail", entry })}
                onActionDone={() => { setView({ type: "main" }); load(); onContractUpdated?.() }}
              />
            )}
            {view.type === "content" && (
              <ContentView
                content={detail.content ?? "No content stored."}
                onBack={() => setView({ type: "main" })}
              />
            )}
            {view.type === "history-detail" && (
              <HistoryDetailView
                entry={view.entry}
                onBack={() => setView({ type: "main" })}
              />
            )}
          </>
        )}

        <div className="border-t pt-3 flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>

          {detail && view.type === "main" && (
            detail.status === "analysed" && username ? (
              <ActionButtons
                contractId={detail.contract_id}
                username={username}
                onActionDone={() => { setView({ type: "main" }); load(); onContractUpdated?.() }}
              />
            ) : detail.status === "analysed" && !username ? (
              <p className="text-xs text-muted-foreground">
                Set a username to approve, deny or modify.
              </p>
            ) : null
          )}
        </div>
      </div>
    </div>
  )
}
