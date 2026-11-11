# Núcleo 2.0 — M0: validação de backup real de uma origem local
**Data:** 2026-11-11  
**Estado:** verificação de preservação concluída **para o arquivo recebido**, sem migração ou homologação documental global.

## Evidência
- Origem: exportação manual via botão `Backup local`, formato `painel-central-nucleo-legacy-backup`, schema 1.
- Momento declarado pelo exportador: `2026-11-11T18:53:36.268Z`.
- Chave de origem: `nucleo_painel_central_pages_v3`.
- SHA-256 conferido sobre o JSON bruto da coleção: `83fc9795454568efdccfcf32746d684d5ff9890267273bfb1236012c49c09438`.
- Resultado: SHA-256 corresponde ao valor exportado; **82 páginas declaradas = 82 verificadas**.
- 8 áreas, 36 marcadores de seed/estado e 1 chave de páginas; 37 entradas locais.
- 0 IDs duplicados; 0 conteúdos com hash duplicado; 0 páginas com campo `content` vazio.
- Todas as páginas incluem `id`, `areaId`, `title`, `content`, `tags`, `createdAt`, `updatedAt` e `versions`.
- **0 versões no campo `versions` em todas as 82 páginas** — isso não prova perda de versões, somente ausência neste snapshot.
- Datas dos registros cobrem `2026-07-08T15:59:33.602Z` a `2026-07-08T16:05:50.240Z`; não presumir contemporaneidade da descrição técnica.

## Inventário por área
| Área | Páginas |
|---|---:|
| estado-atual | 22 |
| principios | 14 |
| arquitetura | 13 |
| atlas | 11 |
| ia-orquestradora | 9 |
| biblioteca | 7 |
| evolucao | 5 |
| consciencia | 1 |
| **TOTAL** | **82** |

## Títulos coincidentes (não são duplicatas confirmadas)
- `Mapa Geral do Sistema`: `atlas` (ID `mrc9jxeq-2az62q`) e `estado-atual` (ID `mrc9jxer-sgetxb`).
- `Banco de Dados`: `arquitetura` (ID `mrc9jxeq-cy05va`) e `estado-atual` (ID `mrc9jxer-i6etwo`).
- `Integrações`: `arquitetura` (ID `mrc9jxeq-n8eiti`) e `estado-atual` (ID `mrc9jxer-cxxqok`).

Os pares têm conteúdos diferentes; **não mesclar nem eliminar por título**.

## Governança de patrimônio
- A íntegra do backup contém documentação estratégica e **não foi enviada ao GitHub, ao Drive ou ao banco** nesta etapa. Deve permanecer sob guarda privada do operador.
- O manifesto com hashes individuais está no relatório de auditoria fornecido ao operador, não neste repositório.
- Verificação cobre **apenas a origem local exportada**; não confirma existência/ausência de outros acervos em outros navegadores ou dispositivos.
- Páginas-modelo e descritivos históricos são conteúdo a preservar, mas não prova atualizada de comportamento real da aplicação. Não promover automaticamente para autoridade vigente.
- M1 exige staging e reconciliação por identidade/proveniência/hash; confirmação RLS/grants em JWT real; proibição de overwrite silencioso; trilha de revisões imutáveis e validação da governança antes de qualquer importação.
- Nenhuma query de escrita, migration, deduplicação, limpeza de flags ou modificação da aplicação foi realizada neste ato.

**Conclusão:** M0 — backup real de **uma origem local validado e preservável**. M0 global e migração M1 **ainda não homologadas**.
