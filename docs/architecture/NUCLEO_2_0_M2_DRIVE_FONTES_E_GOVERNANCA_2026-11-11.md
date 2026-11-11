# Núcleo 2.0 — M2 | Governança das referências do Google Drive

**Data:** 11/11/2026  
**Autoridade:** Mapa Mestre Núcleo 2.0 V1.0 — Escopo Congelado  
**Natureza:** contrato técnico e inventário de metadados; **não implica homologação da Base V1.2**.

## 1. Origem e decisões herdadas

Fontes consultadas no Drive conectado (leitura, sem edição):
- `RASTREAMENTO DOCUMENTAL DO GOOGLE DRIVE — AMOR DE FAMÍLIA — V1.0`: separar fontes operacionais atuais, históricas, restritas e duplicações, sem migrar contatos pessoais à documentação geral.
- `DIRETRIZ MESTRA DE COMPILAÇÃO E UNIFICAÇÃO DOCUMENTAL — V1.0`: **RASTREAR → ENTENDER → EXTRAIR → CLASSIFICAR → CONFRONTAR → CONSOLIDAR**, preservando origens, versões, divergências, regras e valores históricos sem promovê-los a vigentes.
- `FASE6_POLITICA_ACESSO_PRIVADO_E_REGRAS_DE_LIBERACAO_2026-11-06.md`: ZIP integral administrativo é privado, e visões por especialista exigem derivação e aprovação. ACL do ZIP não equivale a ACL por documento.
- `FASE6_TERMO_DECISAO_HOMOLOGACAO_PENDENTE_2026-11-06.md`: aprovação oficial **PENDENTE**, documento não assinado.
- `FASE11_RELATORIO_UNICO_RESTAURACAO_CADEIA_2026-11-10.md`: recuperação isolada aprovada a partir de partes baixadas na fase anterior. Registra 917 identidades originais, 29.594 ocorrências de proveniência, pacote de 238.902.964 bytes e SHA-256 `723672bc59ba72d2855db94ef46d9f45929753fbdb82f1d6266f22cbb441cc3f`. Delta mantém identidade adicional PENDENTE e não foi mesclado.

**Status de fonte:** a base V1.2 é `provisorio` / `pendente_homologacao`. Nem a recuperação da Fase 11 nem a preservação de bytes autorizam promoção documental.

## 2. M2: referência sem duplicação de conteúdo

- Google Drive continua hospedando o arquivo original. Núcleo registra apenas **metadados de referência**, sem conteúdo, token OAuth, credencial, permissão pública inferida ou download automático.
- Cada item usa a identidade estável composta `provider + provider_file_id`; título igual não implica mesma identidade. Arquivo com mesmo nome e IDs distintos requer reconciliação.
- Campos mínimos: nome observado, MIME, pasta original (se verificada), timestamp de modificação, checksum **apenas se efetivamente conhecido**, classe de acesso, autoridade, estado de referência e nota de proveniência.
- `source_access_class='nao_verificado'` por padrão. `shared=false` não equivale a prova de ausência de acessos herdados sem inspecionar ACL. Não inferir `publico_verificado` sem evidência explícita.
- `authority_state='nao_classificado'` por padrão. `vigente_comprovado` exige decisão externa; campos de autoridade são evidências classificatórias, não motor de aprovação automática.
- `content_imported=false` é invariante da M2. Não anexar conteúdo de Drive, não converter ZIP em páginas do Núcleo, não popular as 82 páginas locais.
- `INSERT`/ `SELECT` condicionados a `nucleo_manage` via RLS da M1; sem privilégios de `UPDATE`/`DELETE` no navegador ou service_role.
- Não registrar no GitHub ou no frontend listas completas de arquivos privados, IDs individuais do ZIP, caminhos sensíveis ou URLs de acesso. Exemplos dos testes são sintéticos.

## 3. Fontes que exigem tratamento separado

| Grupo | Tratamento M2 |
|---|---|
| Documento de rastreamento V1.0 | Referência de método documental; não valida preços e custos antigos |
| Diretriz Mestra V1.0 | Referência de governança, preservando sua literalidade |
| Base V1.2 privada | Envoltório **administrativo**, não biblioteca oficial nem acessível a especialistas |
| 29 segmentos e manifestos | Identidades técnicas do **mesmo** arquivo lógico; não contar como 29 bases |
| Fases 7–11 | Evidências históricas e testes de restauração; não constituem homologação |
| Planilhas operacionais | Continuam como fontes vivas; Núcleo registra vínculo e necessidade de revisão |
| Arquivos restritos/terceiros | Permissão negada por padrão; nunca projetar URL pública nem expor trechos |

A coleta direta do Drive nesta revisão confirmou metadados das duas diretrizes e da pasta privada V1.2; a pasta estava identificada como não compartilhada, com controle de proprietário. **Não foi realizada nova auditoria integral de bytes/ACLs das 29 partes nesta M2.**

## 4. Contrato com a M1

A migration **candidata** `20261111210000_nucleo_m2_source_references_CANDIDATA.sql` cria `public.nucleo_source_references`, tabela de metadados pertencente ao Núcleo existente, não um sistema paralelo. Não modifica `nucleo_documents` ou `nucleo_import_batches`; não muda a fonte local da UI.

Portões:
1. CI PostgreSQL 17 com contrato RLS M1 já aplicado: autorizado/legado/scoped/anon/revogação/colisão/imutabilidade.
2. Aprovação de estado do Core, conferência de policies e default privileges, migration versionada.
3. Aplicação somente aditiva, tabela vazia. Nenhuma referência privada importada automaticamente.
4. Futuramente, exibição na Biblioteca do Núcleo somente para usuários autorizados, com consulta autenticada do servidor ou Supabase RLS, nunca links codificados em bundle público.
5. Referências dirigem o operador ao **arquivo original** sob ACL do Drive. Núcleo não contorna ou replica permissões do Drive.

**Ponto de parada de publicação:** a fonte V1.2 permanece pendente de homologação; não distribuir visão nem elevar autoridade em razão da M2.
