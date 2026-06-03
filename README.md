# Crata AI — Themia

Esta herramienta permite a los despachos de abogados trabajar sobre documentos de forma colaborativa, usando modelos para facilitar análisis de riesgo en distintos tipos de contratos.

## Stack Tecnológico Utilizado
* **Frontend:** React (Vite), Tailwind CSS, Shadcn UI.
* **Backend:** FastAPI (Python).
* **Base de Datos:** SQLite con SQLAlchemy.
* **IA:** Groq API.

## Principales Decisiones Técnicas y de Arquitectura

### 1. IA Multi-Modelo
En lugar de utilizar un único modelo, se utilizan varios en función de las necesidades del mismo:
* **Clasificación (Llama-3.1-8b-instant):** Rápido para clasificar los documentos según su tipo.
* **Extracción de Metadatos (Llama 4 Scout 17b):** Eficiencia MoE ideal para procesamiento contextual intermedio.
* **Síntesis y Severidad (Llama-3.3-70b-versatile):** Verificación de contrato con la normativa y generación del resumen ejecutivo final estructurado para el abogado.

### 2. Mitigación de Alucinaciones mediante Few-Shot Grounding
Para evitar que la IA invente leyes o aplique el derecho de otros países, se utiliza la técnica few-shot mediante archivos json locales. Los modelos evaluarán semánticamente las similitudes entre los documentos aportados y los casos ejemplo reales.

### 3. Trazabilidad e Historial Colaborativo
Ya que se menciona que varios abogados utilizarán la herramienta, el frontend permitirá al usuario añadir un `username` para ser identificado y así trazar cualquier modificación a un documento subido.

## Instrucciones de Ejecución

### Prerrequisitos
* **Python 3.12+** con **`uv`** instalado (Instalación rápida: `pip install uv` o `curl -LsSf https://astral.sh/uv/install.sh`).
* **Node.js v20+ o v22+** (Requerido para el correcto funcionamiento de Vite).
* Clave API de Groq configurada en el entorno (`GROQ_API_KEY`).
* Claves de Langsmith para trazabilidad.

### Backend
* `cd backend`
* Solo la primera vez para crear la BBDD `uv run python -m app.db.init_db`
* `uv run fastapi dev`

### Frontend
* `cd frontend`
* `npm i`
* `npm run dev`