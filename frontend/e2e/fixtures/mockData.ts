/**
 * Mock data matching backend schemas (app/schemas/contract.py).
 *
 * Covers every contract type and every possible status so tests can exercise
 * all frontend code paths without a running backend.
 */

// ---------------------------------------------------------------------------
// Schema types (mirrors backend Pydantic models)
// ---------------------------------------------------------------------------

export type ContractStatus =
  | "pending"
  | "analysing"
  | "analysed"
  | "unsupported"
  | "approved"
  | "denied"
  | "modified"

export type ContractAction = "ANALYSE" | "APPROVE" | "DENY" | "MODIFY"

export type ContractType =
  | "alquiler"
  | "compraventa"
  | "servicios"
  | "laboral"
  | "nda"
  | "unsupported"

export type RiskLevel = "low" | "medium" | "high" | "severe"
export type Severity = "low" | "medium" | "high" | "severe"

// ContractListItem (GET /contracts/)
export interface MockListItem {
  contract_id: string
  filename: string
  contract_type: ContractType | null
  status: ContractStatus
  overall_risk: RiskLevel | null
  uploaded_by: string | null
  created_at: string | null
  updated_at: string | null
}

// HistoryEntryResponse
export interface MockHistoryEntry {
  id: string
  action: ContractAction | null
  username: string | null
  user_feedback: string | null
  ai_output: string | null
  created_at: string | null
}

// ContractDetailResponse
export interface MockDetail {
  contract_id: string
  filename: string
  contract_type: ContractType | null
  status: ContractStatus
  uploaded_by: string | null
  content: string | null
  analysis_result: string | null
  created_at: string | null
  updated_at: string | null
  history: MockHistoryEntry[] | null
}

// ContractUploadResponse
export interface MockUploadResponse {
  contract_id: string
  filename: string
  uploaded_by: string | null
  status: ContractStatus
  created_at: string | null
}

// ContractActionResponse
export interface MockActionResponse {
  contract_id: string
  status: ContractStatus
}

// ---------------------------------------------------------------------------
// Analysis result shapes (stored as JSON string in analysis_result)
// ---------------------------------------------------------------------------

interface RedFlag {
  clause_quote: string
  issue: string
  law_reference: string
  severity: Severity
}

interface AnalysisResult {
  unsupported?: boolean
  message?: string
  contract_type?: ContractType
  summary?: string
  overall_risk?: RiskLevel
  metadata?: Record<string, unknown>
  red_flags?: RedFlag[]
}

function toAnalysisJson(result: AnalysisResult): string {
  return JSON.stringify(result)
}

// ---------------------------------------------------------------------------
// Analysis results — one per supported contract type
// ---------------------------------------------------------------------------

export const analysisResults: Record<ContractType, AnalysisResult> = {
  alquiler: {
    contract_type: "alquiler",
    summary:
      "Contrato de arrendamiento de vivienda habitual por 12 meses. Incluye cláusulas de fianza y penalizaciones por impago. Se detectan restricciones abusivas sobre el uso del inmueble.",
    overall_risk: "medium",
    metadata: {
      duration_months: 12,
      monthly_rent: "850 EUR",
      deposit: "1.700 EUR",
      parties: ["Arrendador S.A.", "Juan García Martínez"],
      automatic_renewal: true,
    },
    red_flags: [
      {
        clause_quote:
          "El arrendatario renuncia expresamente a reclamar cualquier desperfecto preexistente a la firma del presente contrato.",
        issue:
          "Renuncia de derechos del arrendatario contraria a la normativa de arrendamientos urbanos. Cláusula potencialmente nula.",
        law_reference: "Ley 29/1994 de Arrendamientos Urbanos, art. 21",
        severity: "high",
      },
      {
        clause_quote:
          "Queda expresamente prohibida la tenencia de mascotas de cualquier tipo en el inmueble arrendado.",
        issue:
          "Restricción de uso habitual del hogar que puede considerarse desproporcionada según la jurisprudencia reciente.",
        law_reference: "LAU art. 6; STS 2021",
        severity: "medium",
      },
    ],
  },

  compraventa: {
    contract_type: "compraventa",
    summary:
      "Compraventa de inmueble residencial por 320.000 EUR. El contrato omite mencionar cargas hipotecarias pendientes y establece condiciones de resolución desequilibradas.",
    overall_risk: "high",
    metadata: {
      price: "320.000 EUR",
      property: "C/ Mayor 15, 3ºA — Madrid",
      parties: ["Promotora XYZ S.L.", "María López Fernández"],
      notary_required: true,
      payment_method: "Hipoteca + señal 10%",
    },
    red_flags: [
      {
        clause_quote:
          "El comprador acepta el inmueble en el estado en que se encuentra, renunciando a cualquier reclamación por vicios ocultos.",
        issue:
          "La renuncia a vicios ocultos es nula de pleno derecho cuando se trata de un consumidor final.",
        law_reference: "Real Decreto Legislativo 1/2007, art. 114–117",
        severity: "severe",
      },
      {
        clause_quote:
          "En caso de resolución por causa imputable al comprador, el vendedor retendrá el 30% del precio total como penalización.",
        issue:
          "Cláusula penal desproporcionada. La jurisprudencia limita estas penalizaciones a la cantidad entregada como señal.",
        law_reference: "Código Civil art. 1152–1154; TS 18/03/2019",
        severity: "high",
      },
      {
        clause_quote:
          "Las cargas y gravámenes que pudieran existir sobre la finca serán asumidos íntegramente por el comprador.",
        issue:
          "El vendedor tiene obligación de entregar el bien libre de cargas. Esta cláusula invierte dicha responsabilidad.",
        law_reference: "Código Civil art. 1461, 1474",
        severity: "high",
      },
    ],
  },

  servicios: {
    contract_type: "servicios",
    summary:
      "Contrato de prestación de servicios de consultoría tecnológica por 6 meses. Alcance bien definido, retribución clara y cláusulas de confidencialidad razonables. Riesgo bajo.",
    overall_risk: "low",
    metadata: {
      service_type: "Consultoría IT — Transformación Digital",
      duration: "6 meses",
      fee: "5.000 EUR/mes",
      parties: ["TechConsult S.L.", "Empresa Cliente S.A."],
      deliverables: ["Análisis de sistemas", "Plan de migración", "Formación"],
      termination_notice_days: 30,
    },
    red_flags: [],
  },

  laboral: {
    contract_type: "laboral",
    summary:
      "Contrato laboral indefinido a jornada completa. Contiene cláusulas que incumplen varios preceptos del Estatuto de los Trabajadores, incluyendo jornada máxima y retribución de horas extra.",
    overall_risk: "severe",
    metadata: {
      position: "Desarrollador de Software Senior",
      salary: "28.000 EUR brutos/año",
      working_hours: "50h/semana",
      parties: ["Empresa Empleadora S.L.", "Carlos Sánchez Ruiz"],
      start_date: "2024-02-01",
      trial_period_months: 6,
    },
    red_flags: [
      {
        clause_quote:
          "La jornada laboral será de 50 horas semanales, incluyendo los sábados como jornada ordinaria.",
        issue:
          "La jornada ordinaria máxima es de 40 horas semanales. Este contrato impone 10 horas extras semanales no compensadas.",
        law_reference: "Estatuto de los Trabajadores, art. 34",
        severity: "severe",
      },
      {
        clause_quote:
          "Las horas trabajadas fuera del horario establecido no generarán retribución adicional ni descanso compensatorio.",
        issue:
          "Las horas extraordinarias deben ser compensadas económicamente o con tiempo de descanso. Cláusula nula.",
        law_reference: "Estatuto de los Trabajadores, art. 35",
        severity: "severe",
      },
      {
        clause_quote:
          "El período de prueba tendrá una duración de 6 meses para todo el personal.",
        issue:
          "El período de prueba máximo para técnicos titulados es de 6 meses, pero debe constar expresamente la categoría profesional.",
        law_reference: "Estatuto de los Trabajadores, art. 14",
        severity: "medium",
      },
      {
        clause_quote:
          "El trabajador cede todos los derechos de propiedad intelectual sobre cualquier obra creada fuera del horario laboral.",
        issue:
          "La cesión de derechos sobre obras creadas fuera del ámbito laboral requiere acuerdo específico y contraprestación.",
        law_reference: "Ley de Propiedad Intelectual, art. 51",
        severity: "high",
      },
    ],
  },

  nda: {
    contract_type: "nda",
    summary:
      "Acuerdo de confidencialidad bilateral con alcance razonable y duración de 2 años. Las obligaciones de las partes están bien equilibradas. Riesgo bajo.",
    overall_risk: "low",
    metadata: {
      type: "Bilateral",
      duration_years: 2,
      parties: ["Alpha Ventures S.L.", "Beta Corp S.A."],
      scope: "Información técnica, financiera y comercial",
      governing_law: "España",
    },
    red_flags: [
      {
        clause_quote:
          "El incumplimiento de cualquier obligación de confidencialidad dará lugar a una penalización de 500.000 EUR.",
        issue:
          "La penalización puede resultar desproporcionada para una PYME. Se recomienda revisar el importe o añadir un límite de responsabilidad.",
        law_reference: "Código Civil art. 1152–1154",
        severity: "medium",
      },
    ],
  },

  unsupported: {
    unsupported: true,
    message:
      "El tipo de contrato no está soportado por el sistema de análisis automático. Por favor, revíselo manualmente.",
  },
}

// ---------------------------------------------------------------------------
// Contract IDs — stable UUIDs used across list + detail mocks
// ---------------------------------------------------------------------------

export const CONTRACT_IDS = {
  alquiler: "11111111-0000-0000-0000-000000000001",
  compraventa: "22222222-0000-0000-0000-000000000002",
  servicios: "33333333-0000-0000-0000-000000000003",
  laboral: "44444444-0000-0000-0000-000000000004",
  nda: "55555555-0000-0000-0000-000000000005",
  unsupported: "66666666-0000-0000-0000-000000000006",
  pending: "77777777-0000-0000-0000-000000000007",
  approved: "88888888-0000-0000-0000-000000000008",
  denied: "99999999-0000-0000-0000-000000000009",
  modified: "aaaaaaaa-0000-0000-0000-00000000000a",
} as const

// ---------------------------------------------------------------------------
// History entries
// ---------------------------------------------------------------------------

const ANALYSE_HISTORY = (
  contractType: ContractType,
  id = "hist-analyse-001",
): MockHistoryEntry => ({
  id,
  action: "ANALYSE",
  username: "LLM",
  user_feedback: null,
  ai_output: toAnalysisJson(analysisResults[contractType]),
  created_at: "2024-01-15T09:00:00",
})

export const historyEntries = {
  analyse_alquiler: ANALYSE_HISTORY("alquiler"),
  analyse_compraventa: ANALYSE_HISTORY("compraventa", "hist-analyse-002"),
  analyse_servicios: ANALYSE_HISTORY("servicios", "hist-analyse-003"),
  analyse_laboral: ANALYSE_HISTORY("laboral", "hist-analyse-004"),
  analyse_nda: ANALYSE_HISTORY("nda", "hist-analyse-005"),

  approve: {
    id: "hist-approve-001",
    action: "APPROVE" as ContractAction,
    username: "reviewer_ana",
    user_feedback: null,
    ai_output: null,
    created_at: "2024-01-15T10:30:00",
  } satisfies MockHistoryEntry,

  deny: {
    id: "hist-deny-001",
    action: "DENY" as ContractAction,
    username: "reviewer_pedro",
    user_feedback: null,
    ai_output: null,
    created_at: "2024-01-15T11:00:00",
  } satisfies MockHistoryEntry,

  modify: {
    id: "hist-modify-001",
    action: "MODIFY" as ContractAction,
    username: "reviewer_laura",
    user_feedback:
      "Eliminar la cláusula de renuncia a vicios ocultos (cláusula 4.2) y ajustar la penalización por resolución al importe de la señal.",
    ai_output: null,
    created_at: "2024-01-15T11:45:00",
  } satisfies MockHistoryEntry,
}

// ---------------------------------------------------------------------------
// Contract content samples (raw text stored in the DB)
// ---------------------------------------------------------------------------

export const contractContents: Record<ContractType, string> = {
  alquiler: `CONTRATO DE ARRENDAMIENTO DE VIVIENDA

En Madrid, a 1 de enero de 2024.

REUNIDOS
De una parte, Arrendador S.A. (en adelante, el ARRENDADOR).
De otra parte, D. Juan García Martínez (en adelante, el ARRENDATARIO).

EXPONEN
Que el ARRENDADOR es propietario del inmueble sito en C/ Ejemplo 1, Madrid.

CLÁUSULAS
1. El presente contrato tendrá una duración de 12 meses.
2. La renta mensual se establece en 850 EUR.
3. El arrendatario renuncia expresamente a reclamar cualquier desperfecto preexistente a la firma del presente contrato.
4. Queda expresamente prohibida la tenencia de mascotas de cualquier tipo en el inmueble arrendado.`,

  compraventa: `CONTRATO DE COMPRAVENTA DE INMUEBLE

En Madrid, a 15 de enero de 2024.

PARTES
Vendedor: Promotora XYZ S.L.
Comprador: Dña. María López Fernández

OBJETO
El vendedor transmite al comprador el inmueble sito en C/ Mayor 15, 3ºA, Madrid, por precio de 320.000 EUR.

CLÁUSULAS
1. El comprador acepta el inmueble en el estado en que se encuentra, renunciando a cualquier reclamación por vicios ocultos.
2. En caso de resolución por causa imputable al comprador, el vendedor retendrá el 30% del precio total como penalización.
3. Las cargas y gravámenes que pudieran existir sobre la finca serán asumidos íntegramente por el comprador.`,

  servicios: `CONTRATO DE PRESTACIÓN DE SERVICIOS

En Barcelona, a 1 de febrero de 2024.

PARTES
Prestador: TechConsult S.L.
Cliente: Empresa Cliente S.A.

OBJETO
El prestador se compromete a prestar servicios de consultoría tecnológica para la transformación digital del cliente.

ALCANCE
- Análisis del estado actual de sistemas
- Plan de migración a la nube
- Formación del equipo técnico

RETRIBUCIÓN: 5.000 EUR/mes durante 6 meses.
CONFIDENCIALIDAD: Ambas partes se obligan a mantener la confidencialidad de la información intercambiada.`,

  laboral: `CONTRATO DE TRABAJO INDEFINIDO

En Sevilla, a 1 de febrero de 2024.

PARTES
Empresa: Empresa Empleadora S.L.
Trabajador: D. Carlos Sánchez Ruiz

CONDICIONES
- Categoría: Desarrollador de Software Senior
- Salario bruto anual: 28.000 EUR
- La jornada laboral será de 50 horas semanales, incluyendo los sábados como jornada ordinaria.
- Las horas trabajadas fuera del horario establecido no generarán retribución adicional ni descanso compensatorio.
- El período de prueba tendrá una duración de 6 meses para todo el personal.
- El trabajador cede todos los derechos de propiedad intelectual sobre cualquier obra creada fuera del horario laboral.`,

  nda: `ACUERDO DE CONFIDENCIALIDAD (NDA)

En Valencia, a 10 de enero de 2024.

PARTES
Alpha Ventures S.L. y Beta Corp S.A. (en adelante conjuntamente "las Partes").

OBJETO
Las Partes desean intercambiar información confidencial con el fin de evaluar una posible colaboración comercial.

OBLIGACIONES
Cada Parte se compromete a: (i) mantener la confidencialidad de la Información Confidencial recibida; (ii) no divulgarla a terceros sin consentimiento previo; (iii) usarla exclusivamente para la finalidad prevista.

DURACIÓN: 2 años desde la firma.
PENALIZACIÓN: El incumplimiento de cualquier obligación de confidencialidad dará lugar a una penalización de 500.000 EUR.`,

  unsupported: `TESTAMENTO OLÓGRAFO

Yo, D. Roberto Ejemplo, mayor de edad, en plenas facultades mentales, otorgo el presente testamento:

Lego a mi hija Ana la totalidad de mis bienes inmuebles.
Lego a mi hijo Luis la totalidad de mis bienes muebles y cuentas bancarias.

Este documento no es un tipo de contrato soportado por el sistema.`,
}

// ---------------------------------------------------------------------------
// List items — one per contract type / status combination
// ---------------------------------------------------------------------------

const ts = (offset = 0) =>
  new Date(Date.UTC(2024, 0, 15, 9, 0, 0) + offset * 3600_000).toISOString()

export const listItems: Record<string, MockListItem> = {
  alquiler_analysed: {
    contract_id: CONTRACT_IDS.alquiler,
    filename: "contrato_alquiler_madrid.txt",
    contract_type: "alquiler",
    status: "analysed",
    overall_risk: "medium",
    uploaded_by: "user_test",
    created_at: ts(0),
    updated_at: ts(1),
  },
  compraventa_analysed: {
    contract_id: CONTRACT_IDS.compraventa,
    filename: "compraventa_piso_mayor.txt",
    contract_type: "compraventa",
    status: "analysed",
    overall_risk: "high",
    uploaded_by: "user_test",
    created_at: ts(2),
    updated_at: ts(3),
  },
  servicios_analysed: {
    contract_id: CONTRACT_IDS.servicios,
    filename: "servicios_consultoria_tech.txt",
    contract_type: "servicios",
    status: "analysed",
    overall_risk: "low",
    uploaded_by: "user_test",
    created_at: ts(4),
    updated_at: ts(5),
  },
  laboral_analysed: {
    contract_id: CONTRACT_IDS.laboral,
    filename: "contrato_laboral_dev.txt",
    contract_type: "laboral",
    status: "analysed",
    overall_risk: "severe",
    uploaded_by: "user_test",
    created_at: ts(6),
    updated_at: ts(7),
  },
  nda_analysed: {
    contract_id: CONTRACT_IDS.nda,
    filename: "nda_alpha_beta.txt",
    contract_type: "nda",
    status: "analysed",
    overall_risk: "low",
    uploaded_by: "user_test",
    created_at: ts(8),
    updated_at: ts(9),
  },
  unsupported: {
    contract_id: CONTRACT_IDS.unsupported,
    filename: "testamento_olografo.txt",
    contract_type: "unsupported",
    status: "unsupported",
    overall_risk: null,
    uploaded_by: "user_test",
    created_at: ts(10),
    updated_at: ts(10),
  },
  pending: {
    contract_id: CONTRACT_IDS.pending,
    filename: "contrato_pendiente.txt",
    contract_type: null,
    status: "pending",
    overall_risk: null,
    uploaded_by: "user_test",
    created_at: ts(11),
    updated_at: ts(11),
  },
  approved: {
    contract_id: CONTRACT_IDS.approved,
    filename: "nda_aprobado.txt",
    contract_type: "nda",
    status: "approved",
    overall_risk: "low",
    uploaded_by: "user_test",
    created_at: ts(12),
    updated_at: ts(14),
  },
  denied: {
    contract_id: CONTRACT_IDS.denied,
    filename: "laboral_denegado.txt",
    contract_type: "laboral",
    status: "denied",
    overall_risk: "severe",
    uploaded_by: "user_test",
    created_at: ts(15),
    updated_at: ts(17),
  },
  modified: {
    contract_id: CONTRACT_IDS.modified,
    filename: "compraventa_modificada.txt",
    contract_type: "compraventa",
    status: "modified",
    overall_risk: "high",
    uploaded_by: "user_test",
    created_at: ts(18),
    updated_at: ts(20),
  },
}

// Convenience: all items as an array
export const allListItems = Object.values(listItems)

// ---------------------------------------------------------------------------
// Detail responses — built from list items + content + history
// ---------------------------------------------------------------------------

function makeDetail(
  item: MockListItem,
  contractType: ContractType,
  history: MockHistoryEntry[],
): MockDetail {
  return {
    contract_id: item.contract_id,
    filename: item.filename,
    contract_type: item.contract_type,
    status: item.status,
    uploaded_by: item.uploaded_by,
    content: contractContents[contractType],
    analysis_result:
      item.status !== "pending"
        ? toAnalysisJson(analysisResults[contractType])
        : null,
    created_at: item.created_at,
    updated_at: item.updated_at,
    history,
  }
}

export const detailResponses: Record<string, MockDetail> = {
  [CONTRACT_IDS.alquiler]: makeDetail(
    listItems.alquiler_analysed,
    "alquiler",
    [historyEntries.analyse_alquiler],
  ),
  [CONTRACT_IDS.compraventa]: makeDetail(
    listItems.compraventa_analysed,
    "compraventa",
    [historyEntries.analyse_compraventa],
  ),
  [CONTRACT_IDS.servicios]: makeDetail(
    listItems.servicios_analysed,
    "servicios",
    [historyEntries.analyse_servicios],
  ),
  [CONTRACT_IDS.laboral]: makeDetail(listItems.laboral_analysed, "laboral", [
    historyEntries.analyse_laboral,
  ]),
  [CONTRACT_IDS.nda]: makeDetail(listItems.nda_analysed, "nda", [
    historyEntries.analyse_nda,
  ]),
  [CONTRACT_IDS.unsupported]: makeDetail(
    listItems.unsupported,
    "unsupported",
    [],
  ),
  [CONTRACT_IDS.pending]: {
    ...makeDetail(listItems.pending, "alquiler", []),
    analysis_result: null,
    contract_type: null,
    content: "Contrato pendiente de análisis.",
  },
  [CONTRACT_IDS.approved]: makeDetail(listItems.approved, "nda", [
    historyEntries.analyse_nda,
    historyEntries.approve,
  ]),
  [CONTRACT_IDS.denied]: makeDetail(listItems.denied, "laboral", [
    historyEntries.analyse_laboral,
    historyEntries.deny,
  ]),
  [CONTRACT_IDS.modified]: makeDetail(listItems.modified, "compraventa", [
    historyEntries.analyse_compraventa,
    historyEntries.modify,
  ]),
}

// ---------------------------------------------------------------------------
// Action responses — returned by POST /:id/approve|deny|modify
// ---------------------------------------------------------------------------

export const actionResponses = {
  approve: (contractId: string): MockActionResponse => ({
    contract_id: contractId,
    status: "approved",
  }),
  deny: (contractId: string): MockActionResponse => ({
    contract_id: contractId,
    status: "denied",
  }),
  modify: (contractId: string): MockActionResponse => ({
    contract_id: contractId,
    status: "modified",
  }),
}

// ---------------------------------------------------------------------------
// Upload response
// ---------------------------------------------------------------------------

export function makeUploadResponse(filename: string): MockUploadResponse {
  return {
    contract_id: "new-upload-0000-0000-0000-000000000099",
    filename,
    uploaded_by: "user_test",
    status: "pending",
    created_at: new Date().toISOString(),
  }
}
