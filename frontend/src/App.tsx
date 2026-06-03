import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ContractsTable, type Contract, type ContractsTableHandle } from "@/components/ContractsTable"
import { ContractModal } from "@/components/ContractModal"

const API_BASE = "http://127.0.0.1:8000/api/v1/contracts"

export default function App() {
  const [usernameInput, setUsernameInput] = useState("")
  const [username, setUsername] = useState<string | null>(null)
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const tableRef = useRef<ContractsTableHandle>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSetUser = () => {
    const trimmed = usernameInput.trim()
    if (trimmed) setUsername(trimmed)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !username) return
    e.target.value = ""

    setUploading(true)
    setUploadError(null)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("username", username)
      const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: form })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail ?? `Error ${res.status}`)
      }
      tableRef.current?.refresh()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col gap-6 p-6">

      {/* Username bar */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Enter username…"
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSetUser()}
          className="max-w-xs"
        />
        <Button onClick={handleSetUser}>Set user</Button>
        {username && (
          <span className="text-sm text-muted-foreground">
            Logged in as <strong>{username}</strong>
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {uploadError && (
            <span className="text-xs text-destructive">{uploadError}</span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            disabled={!username || uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Upload contract"}
          </Button>
        </div>
      </div>

      {/* Contracts table */}
      <ContractsTable
        ref={tableRef}
        onViewDetails={(c) => setSelectedContract(c)}
      />

      {/* Modal */}
      {selectedContract && (
        <ContractModal
          contract={selectedContract}
          username={username}
          onClose={() => setSelectedContract(null)}
          onContractUpdated={() => tableRef.current?.refresh()}
        />
      )}

    </div>
  )
}
