# MAPA SOBERANO DO CCH / SAÚDE NO PAINEL CENTRAL

**Versão:** v4.0 — FROZEN  
**Data:** 08/11/2026  
**Status:** VIGENTE · FROZEN  
**Substitui:** v3.5 FROZEN  
**Base:** `main@e1893f10bd1d706db2890a65de890064d6eeee36`

## 1. Identidade e método

Permanecem vigentes as identidades canônicas, hierarquia de fontes, princípios de segurança, método Git/GitHub e gates definidos na v3.5.

TESTES MT permanece:
`enfekhgcsbzovxtqdlwh`

Produção permanece:
`xkskyutmtlhivvpfxkjg`

Sandboxes não substituem ambiente canônico.

## 2. Estado anterior

- M0→M9: homologados;
- F10→F13: implementados em Git;
- ativação operacional pendente onde já documentada;
- testes operacionais continuam adiados por decisão do usuário.

## 3. Escopo macro aprovado

O escopo passa a conter:

1. F10 — Dashboard Integrado;
2. F11 — Motor Integrado CCH;
3. F12 — Jornada real completa;
4. F13 — Evolução contínua por dados reais;
5. **F14 — Replanejamento Assistido**;
6. **F15 — Relatórios Longitudinais**;
7. **F16 — Lembretes e Rotina**.

Nenhuma F17 está aprovada.

## 4. F14 — Replanejamento Assistido

### Objetivo

Fechar o ciclo:
dados → estado → decisão → revisão → replanejamento humano.

### Contrato

F14 é uma camada de workflow e ledger.

Ela registra:
- origem F13;
- outcome humano de origem;
- domínios em revisão;
- evidência congelada;
- itens de revisão;
- decisão humana por item;
- estado do caso;
- histórico/supersession quando aplicável.

### Autoridade

F14 não escreve diretamente nas tabelas soberanas de:
- objetivos;
- programa de treino;
- nutrição;
- evolução corporal;
- recuperação;
- exames.

Mudanças reais continuam ocorrendo no especialista correspondente.

## 5. F15 — Relatórios Longitudinais

### Objetivo

Gerar visões consolidadas por período sem remover contexto de:
- origem;
- cobertura;
- confiança;
- desconhecido/ausente;
- algoritmo/versão.

Pode produzir relatório de acompanhamento.

Não pode produzir diagnóstico ou score universal.

## 6. F16 — Lembretes e Rotina

### Objetivo

Ajudar o usuário a lembrar registros e revisões.

Exemplos:
- treino programado;
- diário alimentar;
- avaliação corporal;
- recuperação;
- revisão longitudinal.

Controle de frequência e desligamento deve ser explícito.

## 7. Política sem testes

O usuário autorizou avançar desenvolvimento sem os testes pendentes.

Isso permite:
- arquitetura;
- migrations versionadas;
- código;
- frontend;
- documentação;
- PR/merge de desenvolvimento.

Isso não permite:
- declarar teste PASS;
- Gate B sem requisitos de produção;
- Gate C sem autorização;
- esconder backend ausente;
- inventar dados.

## 8. Gates

Gate A: merge de código/documentação, conforme autorização vigente.

Gate B: alteração de banco produção. Continua separado.

Gate C: deploy. Continua separado.

Gate D: operação destrutiva. Continua exigindo autorização específica.

## 9. Regra de expansão

Nenhuma F17 ou nova autoridade deve ser criada sem nova versão formal deste mapa.

## 10. Próxima frente

A frente oficialmente aberta é:

**F14 — Replanejamento Assistido.**

F15 e F16 estão aprovadas no roadmap, mas entram após a camada de desenvolvimento da F14.
