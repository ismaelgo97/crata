# Plan Inicial 

## 1. Alcance
Se planea construir una aplicación que permite a un despacho de abogados analizar riesgos de disintos tipos de contrato entre varias partes interesadas.

**Funcionalidades Incluidas:**
* **Subida de Documentos:** Interfaz para subir un contrato.
* **Pipeline de IA usando Groq:** 
  1. Clasificación del tipo de contrato (Alquiler, Compraventa, Laboral, NDA, Servicios).
  2. Extracción automatizada de metadatos clave.
  3. Análisis profundo de riesgos usando la técnica few-shots.
  4. Generación de matriz de severidad (Muy Bajo a Severo) y resumen del documento.
* **Trazabilidad:** Sistema multiusuario simplificado por alias (`username`) sin login. Registro de auditoría de cambios.
* **Human-in-the-Loop:** Interfaz para aprobar, denegar o modificar el análisis enviando feedback iterativo a la IA.

## 2. Supuestos
* **Formato de Archivos:** Se recibirán documentos en formato limpio como txt o md.
* **Legislación Aplicable:** Los casos de ejemplo se centrarán estrictamente en el marco jurídico común de España (LAU, Código Civil, Estatuto de los Trabajadores).
* **Privacidad:** Se asume que los documentos subidos son fictiocios o anonimizados.

## 4. Riesgos
* **Alucinación en Fuentes Legales.** Las LLM tienden a inventar artículos de leyes.
  * *Solución:* Inyectar al prompt datos reales de ejemplo para que pueda asociarlos fácilmente.
* **Formatos de Salida de la IA Inconsistentes.** Se pueden producir errores en el backend si no se respetan tipos.
  * *Solución:* Forzar a los modelos a devolver formatos JSON generalizados usando **Pydantic** en los casos necesarios.

## 5. Funcionalidades excluidas
Funcionalidades que se añadirían con más tiempo y planeamiento de producción:
* Autenticación real (JWT, OAuth2, cookies de sesión).
* Base de datos vectorial para casos reales.
* Procesamiento de PDFs escaneados complejos usando OCR.