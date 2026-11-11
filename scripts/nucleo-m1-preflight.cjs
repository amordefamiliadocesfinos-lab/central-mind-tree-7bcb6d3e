#!/usr/bin/env node
/**
 * M1 preflight: leitura OFFLINE e estritamente sem escrita no banco.
 * Usage: node scripts/nucleo-m1-preflight.cjs /local/private/backup.json [--manifest /local/private/manifest.json]
 * JSON do usuário permanece no equipamento que executa este comando.
 */
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');

const AREAS = new Set(['biblioteca','consciencia','arquitetura','principios','atlas','ia-orquestradora','evolucao','estado-atual']);
const REQUIRED = ['id','areaId','title','content','tags','createdAt','updatedAt','versions'];
const sha = text => crypto.createHash('sha256').update(text,'utf8').digest('hex');
const requireValid = (condition, message) => { if (!condition) throw new Error(message); };
const norm = text => text.normalize('NFKC').trim().toLocaleLowerCase('pt-BR');

function inspect(backup) {
  requireValid(backup && typeof backup === 'object' && !Array.isArray(backup), 'Backup JSON inválido');
  requireValid(backup.format === 'painel-central-nucleo-legacy-backup' && backup.schemaVersion === 1, 'Formato/versão inesperados');
  requireValid(backup.pagesKey === 'nucleo_painel_central_pages_v3', 'Chave documental inesperada');
  requireValid(backup.entries && typeof backup.entries === 'object' && !Array.isArray(backup.entries), 'Entradas inválidas');
  requireValid(Object.keys(backup.entries).every(key => key.startsWith('nucleo_') && typeof backup.entries[key] === 'string'), 'Entradas fora do escopo');
  const raw = backup.entries[backup.pagesKey];
  requireValid(typeof raw === 'string', 'Coleção documental não encontrada');
  requireValid(sha(raw) === backup.pagesRawSha256, 'Checksum SHA-256 não corresponde ao conteúdo bruto');
  const pages = JSON.parse(raw);
  requireValid(Array.isArray(pages) && pages.length === backup.pagesCount, 'Contagem de páginas divergente');
  const seen = new Set();
  const titleMap = new Map();
  const areas = Object.fromEntries([...AREAS].map(name => [name,0]));
  const manifest = [];
  let versionsCount = 0;
  pages.forEach((page,index) => {
    requireValid(page && typeof page === 'object' && REQUIRED.every(key => Object.hasOwn(page,key)), 'Campos ausentes no documento índice ' + index);
    requireValid(typeof page.id === 'string' && page.id.length > 0 && !seen.has(page.id), 'ID ausente ou duplicado no índice ' + index);
    requireValid(AREAS.has(page.areaId), 'Área inválida no documento ' + page.id);
    requireValid(typeof page.title === 'string' && typeof page.content === 'string' && page.title.trim() && page.content.trim(), 'Documento sem texto no índice ' + index);
    requireValid(Array.isArray(page.tags) && page.tags.every(t => typeof t === 'string'), 'Tags inválidas: ' + page.id);
    requireValid(Array.isArray(page.versions), 'Versões inválidas: ' + page.id);
    for (const date of [page.createdAt,page.updatedAt]) requireValid(typeof date === 'string' && !Number.isNaN(Date.parse(date)), 'Data inválida: ' + page.id);
    const verIds = new Set();
    for (const v of page.versions) {
      requireValid(v && typeof v.id === 'string' && !verIds.has(v.id) && typeof v.title === 'string' && typeof v.content === 'string', 'Snapshot inválido ou duplicado: ' + page.id);
      verIds.add(v.id);
    }
    versionsCount += page.versions.length;
    seen.add(page.id);
    areas[page.areaId] += 1;
    const title = norm(page.title);
    const titles = titleMap.get(title) ?? [];
    titles.push({ id:page.id, area:page.areaId });
    titleMap.set(title,titles);
    manifest.push({ id:page.id, areaId:page.areaId, title:page.title, pageSha256:sha(JSON.stringify(page)), contentSha256:sha(page.content), versions:page.versions.length });
  });
  const repeatedTitles = [...titleMap.entries()].filter(([,documents]) => documents.length>1).map(([title,documents]) => ({ title,documents }));
  const flags = Object.keys(backup.entries).filter(key => key !== backup.pagesKey);
  return {
    format: 'painel-central-nucleo-m1-offline-preflight',
    schemaVersion: 1,
    status: 'VALIDATED_NO_IMPORT',
    exportedAt: backup.exportedAt,
    pagesCount:pages.length,
    pagesRawSha256:backup.pagesRawSha256,
    flagCount:flags.length,
    areaCounts:areas,
    versionsCount,
    repeatedTitles,
    documents:manifest
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.length > 3 || (args.length===3 && args[1]!=='--manifest')) {
    throw new Error('Usage: node scripts/nucleo-m1-preflight.cjs <private-backup.json> [--manifest <private-manifest.json>]');
  }
  const source = path.resolve(args[0]);
  const result = inspect(JSON.parse(fs.readFileSync(source,'utf8')));
  // Não publicar arquivo de backup ou resultados detalhados como artefatos de CI.
  if (args.length===3) {
    const destination=path.resolve(args[2]);
    requireValid(source!==destination, 'Origem e destino devem ser diferentes');
    fs.writeFileSync(destination,JSON.stringify(result,null,2),'utf8');
  }
  process.stdout.write(JSON.stringify({status:result.status,pagesCount:result.pagesCount,flagCount:result.flagCount,versionsCount:result.versionsCount,areaCounts:result.areaCounts,repeatedTitleGroups:result.repeatedTitles.length,pagesRawSha256:result.pagesRawSha256},null,2)+'\n');
}
if (require.main===module) {
  try { main(); } catch(e) { console.error('M1 PREFLIGHT FAILED:',e.message); process.exitCode=1; }
}
module.exports={inspect};
