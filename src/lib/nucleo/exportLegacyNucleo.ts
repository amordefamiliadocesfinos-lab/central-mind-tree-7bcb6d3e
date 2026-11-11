/**
 * Núcleo legado: exportação somente leitura do armazenamento deste navegador.
 * Não envia conteúdos para servidores e não altera as chaves de origem.
 * O arquivo contém documentos potencialmente sensíveis: armazenar com cuidado.
 */
export async function exportLegacyNucleo(): Promise<{ pageCount: number; keyCount: number }> {
  const entries: Record<string, string> = {};
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key?.startsWith("nucleo_")) {
      const value = window.localStorage.getItem(key);
      if (value !== null) entries[key] = value;
    }
  }
  const rawPages = entries["nucleo_painel_central_pages_v3"];
  if (rawPages === undefined) {
    throw new Error("Nenhuma coleção documental do Núcleo encontrada neste navegador.");
  }
  let pages: unknown;
  try {
    pages = JSON.parse(rawPages);
  } catch {
    throw new Error("O conteúdo local não é JSON válido. Nenhum dado foi alterado.");
  }
  if (!Array.isArray(pages)) {
    throw new Error("A coleção local não é uma lista de páginas. Nenhum dado foi alterado.");
  }
  // Hash calculado sobre a representação literal, sem normalizar nem reordenar documentos.
  const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawPages));
  const sha256 = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  const snapshot = {
    format: "painel-central-nucleo-legacy-backup",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    origin: "localStorage / navegador atual",
    pagesKey: "nucleo_painel_central_pages_v3",
    pagesCount: pages.length,
    pagesRawSha256: sha256,
    // Todas as flags nucleo_* são preservadas exatamente como estavam.
    // Este pacote é para auditoria/restauração assistida, não importação automática.
    entries,
  };
  const json = JSON.stringify(snapshot, null, 2);
  // Garantir que o arquivo contém as mesmas entradas antes de entregá-lo.
  const parsed = JSON.parse(json) as typeof snapshot;
  if (parsed.pagesRawSha256 !== sha256 || parsed.entries[snapshot.pagesKey] !== rawPages) {
    throw new Error("Falha de integridade na preparação do backup.");
  }
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeDate = snapshot.exportedAt.replace(/[:.]/g, "-");
  anchor.href = url;
  anchor.download = `NUCLEO_LEGADO_BACKUP_${safeDate}.json`;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
  return { pageCount: pages.length, keyCount: Object.keys(entries).length };
}
