# M9 — FINAL DOCUMENTARY REVIEW — 2026-11-07

## Parecer

**PASS — PR #487 documentalmente apta para Gate A.**

A revisão final foi executada contra o Mapa Soberano CCH v2 vigente e contra os contratos M9A/M9B, ADR, desenho técnico, segurança, testes e UI.

Este PASS:
- aprova coerência documental;
- não autoriza merge por si só;
- não autoriza migration;
- não autoriza TESTES MT;
- não autoriza banco de produção;
- não autoriza deploy.

## Base de revisão

- repo: `amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e`;
- base da PR: `main@4d6ebbeb71f39b9f3c39a07604e6e1f6a2fe54ae`;
- branch: `docs/health-m9-architecture-20261107`;
- PR: #487.

## Escopo conferido

1. Mapa Soberano v2;
2. M9A Sleep & Recovery;
3. M9B Exams & Biomarkers;
4. Architectural Decisions v1;
5. Technical Design v1;
6. RLS / Grants / Cross-athlete Matrix v1;
7. Test Plan v1;
8. Mobile UI Spec v1;
9. Opening & Acceptance contract.

## Achados corrigidos na revisão

### R1 — Estado do Mapa após PR #486

Problema:
o cabeçalho ainda dizia que a v2 “torna-se vigente” após merge, embora esse merge já tenha ocorrido.

Correção:
- status = `VIGENTE`;
- v1 explicitamente substituída;
- commit que tornou a v2 vigente registrado;
- SHA inicial da emissão renomeada como referência histórica.

### R2 — Estado M9 no Mapa

Problema:
uma seção ainda dizia que M9 permanecia não iniciada.

Correção:
M9 passa a ser descrita com precisão:
- arquitetura concluída na PR #487;
- desenho técnico concluído;
- ainda não integrado à main;
- implementação real não iniciada.

### R3 — Critério de saída M9A/M9B

Problema:
os documentos ainda diziam “pode seguir para desenho técnico” depois de o desenho já ter sido concluído.

Correção:
critério arquitetural marcado como atendido e desenho técnico registrado como concluído.

### R4 — Identidade de check-in M9A

Problema:
`health_recovery_checkins` tinha `metric_code` por linha, mas “uma linha por check-in” deixava ambígua a persistência de várias métricas na mesma interação.

Correção:
- uma linha por métrica observada;
- `checkin_event_id` agrupa o check-in;
- unique lógico `(athlete_id, checkin_event_id, metric_code)`;
- replay não duplica;
- métrica ausente permanece unknown.

### R5 — Void de documento clínico

Problema:
documento clínico tinha status/void, mas não havia RPC explícita de void.

Correção:
`health_m9_void_clinical_document` adicionado ao contrato.

Void de metadado não significa exclusão silenciosa do binário; remoção física é ação separada/destrutiva.

### R6 — Correção de biomarcadores

Problema:
faltava congelar a unidade de correção factual.

Correção v1:
- `health_biomarker_results` são filhos imutáveis do relatório confirmado;
- correção ocorre por supersession/void do `health_lab_report`;
- relatório substituto carrega o conjunto corrigido;
- estado longitudinal é recalculado;
- nenhum UPDATE silencioso do resultado original.

### R7 — RLS de catálogo global

Problema:
`health_biomarker_catalog` não possui `athlete_id`, portanto a regra genérica de policy por atleta não se aplica.

Correção:
- RLS habilitado;
- SELECT global explícito para authenticated via `USING (true)`;
- sem DML frontend;
- aliases sem leitura frontend por padrão na v1.

## Contratos preservados

- `unknown != zero`;
- fato != estado != interpretação != hipótese != decisão != ação;
- tempo na cama != sono efetivo;
- wearable != verdade clínica;
- associação != causalidade;
- documento extraído != fato clínico confirmado;
- valor/unidade/referência originais preservados;
- flags estruturais != diagnóstico;
- correção não destrutiva;
- RLS deny-by-default;
- anon sem acesso;
- RPC-only writes;
- cross-athlete obrigatório;
- documentos privados em `health-private`;
- nenhuma alteração automática de treino, dieta, medicação ou tratamento;
- nenhuma autoria via Lovable Builder/agent.

## Segurança

O desenho herda:
- `public.health_can_read_athlete(uuid)`;
- `public.health_can_write_athlete(uuid)`;
- `health-private`.

RPCs privilegiadas futuras:
- autorização interna;
- `SECURITY DEFINER` somente quando necessário;
- `SET search_path = ''`;
- relações qualificadas por schema;
- EXECUTE revogado de PUBLIC/anon antes do grant mínimo a authenticated.

## Resultado de escopo

A PR #487 continua sendo uma PR **exclusivamente documental**.

Não contém:
- `supabase/migrations/*` M9;
- código React/TypeScript funcional;
- SQL aplicado;
- alteração de Supabase;
- deploy;
- dados reais de Saúde.

## Próxima decisão

**Gate A documental da PR #487.**

Se autorizado e a `main` permanecer na mesma base sem divergência não reconciliada:
1. retirar Draft;
2. merge da PR #487;
3. pós-check da `main`;
4. somente então criar uma branch nova de implementação M9 a partir da `main` vigente.

Nenhuma migration deve ser implementada na branch documental da PR #487.
