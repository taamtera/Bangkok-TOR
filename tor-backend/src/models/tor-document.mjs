// Defaults are applied at application boundaries; MongoDB validators do not set defaults.
// Keep page arrays from extractors intact rather than converting them to a count.
export function normalizeTorDocuments(documents = []) {
  return documents.map(document => ({
    ...document,
    filename: document.filename ?? null,
    sourceFormat: document.sourceFormat ?? 'unknown',
    extractionStatus: document.extractionStatus ?? 'unknown',
    pages: document.pages ?? null,
    extractedText: document.extractedText ?? ''
  }));
}
