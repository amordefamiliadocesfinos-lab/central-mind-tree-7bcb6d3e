# MAPA SOBERANO DO CCH / SAÚDE NO PAINEL CENTRAL

**Versão:** v4.3 — FROZEN  
**Data:** 09/11/2026  
**Status:** VIGENTE · FROZEN  
**Substitui:** v4.2 FROZEN  
**Base reconciliada:** `main@a7380e872baf0b9e82ff749955d160b37cd96af0`

## 1. Estado soberano

- M0→M9: fundação homologada;
- F10→F17: implementados em Git;
- testes operacionais permanecem adiados por autorização do usuário;
- banco produção/deploy não são inferidos a partir de merge.

## 2. Escopo implementado

1. F10 — Dashboard Integrado
2. F11 — Motor Integrado CCH
3. F12 — Jornada real completa
4. F13 — Evolução contínua por dados reais
5. F14 — Replanejamento Assistido
6. F15 — Relatórios Longitudinais
7. F16 — Lembretes e Rotina
8. F17 — Analytics Visual e Histórico

## 3. F17 — estado

- arquitetura: ✅
- implementação: ✅
- read-only: ✅
- migration: n/a
- RPC: n/a
- testes: ⏳ adiados
- deploy: ⏳ adiado

## 4. Cobertura funcional

A matriz oficial está em:

`docs/health/CCH_REQUIREMENTS_COVERAGE_MATRIX_2026-11-09.md`

A reconciliação concluiu que os requisitos funcionais originais conhecidos estão cobertos em arquitetura/código.

## 5. F18

**F18 NÃO ESTÁ ABERTA.**

Nenhuma lacuna funcional conhecida justifica uma nova macrofrente neste checkpoint.

F18 futura exige:
- requisito novo;
- achado objetivo;
- necessidade que não caiba em manutenção/hardening;
- nova versão formal deste mapa.

## 6. Trabalho permitido sem nova macrofase

- hardening;
- correções;
- acessibilidade;
- responsividade;
- performance;
- segurança;
- observabilidade;
- UX;
- documentação;
- preparação futura de TESTES MT/Gate B/Gate C;
- homologação quando o usuário decidir retomar.

## 7. Política de testes

A autorização para avançar sem testes permanece registrada.

Ela não significa PASS.

Nenhum gate de produção pode ser marcado concluído por inferência.

## 8. Diretriz final

**M0→M9 homologados.**

**F10→F17 implementados em Git.**

**Escopo funcional original conhecido coberto.**

**Testes e ativações pendentes permanecem explícitos.**

**F18 não existe no mapa vigente.**
