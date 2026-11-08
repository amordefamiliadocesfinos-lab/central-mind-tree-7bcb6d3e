# CCH / SAÚDE — FECHAMENTO DA CAMADA DE DESENVOLVIMENTO F14→F16

**Data:** 08/11/2026  
**Status:** DESENVOLVIMENTO IMPLEMENTADO · TESTES/ATIVAÇÃO ADIADOS  
**Base:** `main@972bc55e4188c5c57b0688da0ba127bb38da30da`

## F14 — Replanejamento Assistido

### Arquitetura
- PR #516
- merge: `3a12c69ece4a9fa8b36d0e34c6201d176f1a70e1`

### Implementação
- PR #517
- merge: `52d3c7660035d91de0f377bf3c7f8fcdd6b81e1c`

### Entregas
- migration `20261108173325_health_f14_assisted_replanning.sql`;
- ledger de casos;
- itens por domínio com supersession;
- decisões humanas;
- conclusão/void;
- RLS;
- RPCs;
- rota `/saude/replanejamento`;
- fluxo F13 → F14;
- fallback se backend ausente.

### Limite
F14 não altera automaticamente meta, treino, dieta, corpo, recuperação ou dados clínicos.

### Estado operacional
- código: ✅
- testes: ⏳ adiados
- Gate B: ⛔
- deploy: ⛔
- homologação real: ⏳

---

## F15 — Relatórios Longitudinais

### Arquitetura
- PR #518
- merge: `fe1ac871334cd0576d22b463e842c82bc6ad975a`

### Implementação
- PR #519
- merge: `7f9154b2be9512ebe852956c68e4729d8e336a6c`

### Entregas
- rota `/saude/relatorios`;
- relatório longitudinal F13/F14;
- domínios treino, alimentação, corpo e recuperação;
- outcome humano;
- contexto de replanejamento;
- impressão / salvar como PDF via navegador;
- exportação JSON;
- layout de impressão.

### Autoridade
F15 v1 é read-only:
- sem migration;
- sem RPC;
- sem INSERT;
- sem UPDATE;
- sem DELETE.

### Estado operacional
- código: ✅
- testes: ⏳ adiados
- Gate B: n/a
- deploy: ⏳ adiado
- homologação real: ⏳

---

## F16 — Lembretes e Rotina

### Arquitetura
- PR #520
- merge: `7f9bb9db208af7a807462ba5751381f255245910`

### Implementação
- PR #521
- merge: `972bc55e4188c5c57b0688da0ba127bb38da30da`

### Entregas
- migration `20261108173954_health_f16_reminders_routine.sql`;
- regras daily/weekly/interval;
- treino;
- diário alimentar;
- avaliação corporal;
- recuperação;
- revisão longitudinal;
- eventos append-only completed/dismissed;
- timezone IANA validado;
- cálculo por fuso da regra;
- rota `/saude/rotina`;
- rotina de hoje;
- edição/desativação/arquivamento;
- histórico recente.

### Limite
F16 v1:
- não envia push;
- não envia e-mail/SMS/WhatsApp;
- não cria alerta clínico;
- não altera treino/dieta/meta;
- não usa localStorage como fonte substituta.

### Estado operacional
- código: ✅
- testes: ⏳ adiados
- Gate B: ⛔
- deploy: ⛔
- homologação real: ⏳

---

## Conclusão

F14→F16 estão implementadas em Git sob autorização explícita do usuário para avançar sem testes.

Nenhum teste foi convertido em PASS por inferência.

Nenhuma migration F14/F16 foi aplicada em produção nesta frente.

Nenhum deploy foi executado.

F17 não foi aberta.
