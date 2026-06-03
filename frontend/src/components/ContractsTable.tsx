import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const API_BASE = "http://127.0.0.1:8000/api/v1/contracts"

export interface Contract {
  contract_id: string
  filename: string
  contract_type: string | null
  status: string
  overall_risk: string | null
  uploaded_by: string | null
  updated_at: string | null
  content: string | null
}

export interface ContractsTableHandle {
  refresh: () => void
}

const STATUS_STYLES: Record<string, string> = {
  pending:     "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  analysed:    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  unsupported: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  approved:    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  denied:      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  modified:    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
}

const RISK_STYLES: Record<string, string> = {
  low:    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  high:   "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  severe: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

function Badge({ label, styleMap }: { label: string; styleMap: Record<string, string> }) {
  const style = styleMap[label] ?? "bg-muted text-muted-foreground"
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
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

interface Props {
  onViewDetails: (contract: Contract) => void
}

export const ContractsTable = forwardRef<ContractsTableHandle, Props>(
  function ContractsTable({ onViewDetails }, ref) {
    const [contracts, setContracts] = useState<Contract[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchContracts = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(API_BASE + "/")
        if (!res.ok) throw new Error(`Error ${res.status}`)
        setContracts(await res.json())
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    useEffect(() => { fetchContracts() }, [])

    useImperativeHandle(ref, () => ({ refresh: fetchContracts }))

    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Contracts</h2>
          <Button variant="outline" size="sm" onClick={fetchContracts} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </Button>
        </div>

        {error && (
          <p className="text-sm text-destructive">Failed to load contracts: {error}</p>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Uploaded by</TableHead>
                <TableHead>Last updated</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && contracts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No contracts found.
                  </TableCell>
                </TableRow>
              )}
              {contracts.map((c) => (
                <TableRow key={c.contract_id}>
                  <TableCell className="font-mono text-xs">{c.filename}</TableCell>
                  <TableCell>{c.contract_type ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell><Badge label={c.status} styleMap={STATUS_STYLES} /></TableCell>
                  <TableCell>
                    {c.overall_risk
                      ? <Badge label={c.overall_risk} styleMap={RISK_STYLES} />
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>{c.uploaded_by ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{formatDate(c.updated_at)}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => onViewDetails(c)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }
)
