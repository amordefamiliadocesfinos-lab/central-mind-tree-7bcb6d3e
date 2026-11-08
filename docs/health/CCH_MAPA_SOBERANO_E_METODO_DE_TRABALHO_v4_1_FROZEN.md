# MAPA SOBERANO DO CCH / SAÚDE NO PAINEL CENTRAL

**Versão:** v4.1 — FROZEN  
**Data:** 08/11/2026  
**Status:** VIGENTE · FROZEN  
**Substitui:** v4.0 FROZEN  
**Base reconciliada:** `main@972bc55e4188c5c57b0688da0ba127bb38da30da`

## 1. Identidade e método

Permanecem vigentes:

- Git/GitHub como fonte soberana de código;
- `main` canônica;
- Supabase produção `xkskyutmtlhivvpfxkjg`;
- TESTES MT `enfekhgcsbzovxtqdlwh`;
- sandboxes não substituem ambiente canônico;
- Lovable Builder não é autor do CCH;
- gates de banco/deploy permanecem separados.

## 2. Estado consolidado

### M0→M9
Fundação homologada.

### F10→F13
Implementadas em Git, com ativações/homologações pendentes já documentadas.

### F14→F16
Implementadas em Git sob autorização de avanço sem testes.

## 3. Escopo vigente

1. F10 — Dashboard Integrado
2. F11 — Motor Integrado CCH
3. F12 — Jornada real completa
4. F13 — Evolução contínua por dados reais
5. F14 — Replanejamento Assistido
6. F15 — Relatórios Longitudinais
7. F16 — Lembretes e Rotina

**Nenhuma F17 está aprovada.**

## 4. F14 — estado

- arquitetura: ✅
- código: ✅
- migration em Git: ✅
- frontend: ✅
- testes: ⏳ adiados
- banco produção: ⛔
- deploy: ⛔

Autoridade:
workflow humano somente; sem mutação automática de especialistas.

## 5. F15 — estado

- arquitetura: ✅
- código: ✅
- read-only: ✅
- migration: n/a
- testes: ⏳ adiados
- deploy: ⏳ adiado

Autoridade:
apresentação/exportação somente.

## 6. F16 — estado

- arquitetura: ✅
- código: ✅
- migration em Git: ✅
- frontend: ✅
- testes: ⏳ adiados
- banco produção: ⛔
- deploy: ⛔

Autoridade:
lembretes internos e ledger de interação; sem prescrição ou ação automática.

## 7. Política de testes

Por autorização explícita do usuário:

- novas frentes puderam avançar sem aguardar testes;
- teste não executado continua não executado;
- nenhuma frente recebe PASS operacional por inferência.

## 8. Gates

### Gate A
Código/documentação pode ser integrado conforme autorização vigente.

### Gate B
Migration de produção continua exigindo decisão separada.

### Gate C
Deploy continua separado.

### Gate D
Operação destrutiva continua exigindo autorização específica.

## 9. Próximo trabalho permitido

Sem abrir F17, permanecem permitidos:

- hardening;
- correção;
- documentação;
- UX;
- performance;
- acessibilidade;
- segurança;
- preparação futura de ativação.

Nova macrofrente exige versão posterior do mapa.

## 10. Diretriz final

**M0→M9 homologados.**

**F10→F16 implementados em Git.**

**Testes/ativação pendentes permanecem explícitos.**

**Nenhum banco/deploy foi atravessado por inferência.**

**F17 não existe no mapa vigente.**
