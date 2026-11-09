# MAPA SOBERANO DO CCH / SAÚDE NO PAINEL CENTRAL

**Versão:** v4.4 — FROZEN
**Data:** 09/11/2026
**Status:** VIGENTE · FROZEN
**Substitui:** v4.3 FROZEN
**Base:** `main@8ebaf98644df7dde1175d3083f706d00d34c3243`

## 1. Estado soberano

- M0→M9: fundação homologada;
- F10→F17: implementados em Git;
- **F18 — Plano Alimentar Individual: ABERTA**;
- testes operacionais permanecem adiados;
- produção/deploy não são inferidos de merge.

## 2. F18 — Plano Alimentar Individual

### Missão

Adicionar prescrição alimentar estruturada por atleta, versionada junto ao plano M5.

### Entidades v1

1. padrão de dia;
2. refeição planejada;
3. item planejado;
4. alternativa/substituição.

### Princípios

- plano != consumo;
- prescrição não sobrescreve diário;
- alternativa não é substituição automática;
- valores desconhecidos permanecem desconhecidos;
- plano publicado é imutável;
- alterações futuras criam nova versão.

### Macros

- energia;
- proteína;
- carboidratos;
- gorduras;
- fibras.

### UI

Organizar Dieta em:
- Plano;
- Refeições;
- Receitas;
- Diário;
- Evolução.

## 3. Gates

Gate B é necessário antes de ativar a migration F18 em produção.
Gate C permanece separado.
Nenhum teste é considerado PASS sem execução real.

## 4. F19

F19 não está aberta.
