# Núcleo 2.0 — Entrega A+ V1.2 — Bloco 2: reconciliação M2/M4

**Corte de dados:** consulta de leitura ao Core oficial, 13/11/2026. **Mapa soberano:** Núcleo V1.2 congelado. Este documento não cria nova macrofrente, não valida a operação real e não autoriza a Entrega B.

## Inventário das evidências M4 vinculadas

| Frente | Evidências M4 | Tipos presentes |
|---|---:|---|
| NUC-M0 | 2 | PR, workflow |
| NUC-M1 | 7 | PR, workflow, migration |
| NUC-M2 | 4 | PR, workflow, migration |
| NUC-M3 | 9 | PR, workflow, migration |
| NUC-M4 | 20 | PR, workflow |
| NUC-M5 | 7 | PR |
| CRM-UX02 | 2 | PR #296 e #297 |
| SHO-F12 | 0 | Nenhuma linha M4 nesta consulta |
| SHO-F12-1 a SHO-F12-4 | 0 cada | Nenhuma linha M4 nesta consulta |

Total **51** evidências: 49 no Núcleo, 2 em CRM, zero nas frentes Shopee. Todas estão classificadas como `verificado` no registro histórico, não como aprovação de deploy ou homologação visual. **Cinco** registros de migrations Supabase não contêm URL pública, mas têm chave interna. A ausência de URL não torna a evidência automaticamente inválida.

O Core possui **3 referências M2** em `nucleo_source_references`, todas de Google Drive e `validado_metadados`: uma histórica, uma pendente de homologação e uma não classificada. As três indicam `content_imported=false`. São referências privadas independentes, não evidências de PR, e não se ligam automaticamente à M4. O inventário ZIP contém **7 identificadores documentais históricos únicos** catalogados por hash, distintos dessas 3 referências M2. Não importar nem duplicar arquivos.

## Implementação do Bloco 2

`NucleoM2M4Reconciliation` mostra, na supervisão M5 existente, a cobertura de cada **frente real M3** pelos registros M4 carregados na mesma consulta já autorizada. Somente a consulta de metadados M2 é adicional, sob RLS, com limite 100 e estado indeterminado se ocorrer erro ou limite. Em consulta parcial não deduzir ausência de fontes. Nenhum conteúdo privado, chave de arquivo ou dados de cliente é exposto.

O novo painel não substitui a matriz de autoridade por módulo, não reconsulta M3/M4 separadamente e não grava evidências, frentes, mandatos ou documentos. A ausência de M4 em F12 é um **gate de reconciliação**, não prova de inexistência de trabalho. A F12 permanece aberta, conforme mapa congelado.

## Encaminhamento objetivo

**Bloco 2, corte técnico M2/M4:** inventariado e integrado como leitura; vinculação formal de evidências externas continua condicionada à fonte contemporânea e ao especialista competente. O desenvolvimento independente pode avançar ao Bloco 3 (conhecimento e jornadas), sem exigir testes visuais previamente adiados ou reabrir os refinamentos de M5.

Mantidos: Entrega A aceita com ressalvas; A+ em curso; B não autorizada; M3 Salvar, M5 revogação E2E e homologação visual adiados. Não equiparar CI, merge, deploy, teste funcional e aceite.
