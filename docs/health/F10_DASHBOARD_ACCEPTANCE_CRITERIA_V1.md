# F10 — DASHBOARD INTEGRADO — ACCEPTANCE CRITERIA v1

**Status:** DOCUMENTAL — BLOQUEIA IMPLEMENTAÇÃO ATÉ GATE A
**Base:** main@b6b50fc7a72c4e4e911153e8dd7f3aab0b5fc333

## A. Escopo

PASS:
- /saude/hoje é única rota do Dashboard;
- não há nova macrofase;
- F11 não é implementado;
- Dashboard é read-only.

FAIL:
- score integrado;
- decisão integrada;
- mutation automática;
- diagnóstico.

## B. Fonte de verdade

PASS:
- cada indicador aponta para M4/M6/M7/M8/M9;
- não existe tabela factual F10;
- ausência permanece unknown;
- histórico é rotulado com data.

## C. Dados

Treino:
- sessão ativa reconhecida;
- próximo treino reconhecido;
- ausência sem inferência.

Alimentação:
- daily state de hoje;
- rolling 7 dias;
- decisão M7 somente se já existir;
- decisão não é recalculada.

Corpo:
- estado 7 dias;
- fallback histórico datado;
- nenhuma recomendação.

Recuperação:
- cobertura por dimensão;
- agregados somente quando não nulos;
- nenhum readiness score global.

Exames:
- último exame;
- contagem de marcadores;
- última observação fisiológica;
- extração aguardando revisão;
- nenhum diagnóstico.

## D. Unknown / Empty / Error

Testar:
1. atleta sem nenhum dado;
2. somente treino;
3. somente nutrição;
4. Body unobserved;
5. Recovery unobserved;
6. nenhum exame;
7. estado histórico sem estado de hoje;
8. erro em uma fonte com outras fontes disponíveis.

PASS:
- nenhum null vira 0;
- nenhum domínio ausente bloqueia os demais;
- historical != today.

## E. Segurança

PASS:
- RLS existente;
- athlete scope;
- nenhum signed URL/documento;
- cross-athlete impossível;
- nenhuma service role frontend;
- nenhuma nova permissão.

## F. Performance

PASS:
- queries independentes paralelas;
- campos mínimos;
- sem select(*) desnecessário;
- sem fotos/PDF;
- sem N+1;
- build sem regressão.

Não criar RPC agregadora por antecipação.

## G. UI mobile

PASS:
- smartphone sem overflow horizontal;
- 5 domínios acessíveis;
- pendências levam ao domínio correto;
- nenhum semáforo clínico;
- nenhum score geral.

## H. CI

Antes do Gate A de implementação:
- npm ci;
- lint Health/F10;
- full build;
- testes unitários do normalizador/adapter F10;
- teste de empty/historical/error;
- diff restrito à frente F10.

## I. Gates

Sequência:
1. arquitetura documental;
2. PR Draft documental;
3. revisão;
4. Gate A documental;
5. branch nova de implementação;
6. implementação frontend read-only;
7. CI;
8. PR Draft implementação;
9. Gate A implementação;
10. Gate C deploy.

### Gate B

F10 v1 não prevê Gate B porque não prevê migration ou DDL.

Se surgir necessidade real de banco:
- parar;
- documentar;
- revisar arquitetura;
- criar migration;
- TESTES MT;
- Gate B volta a ser obrigatório.

## J. Homologação final

PASS somente com prova em produção autenticada:
- /saude/hoje;
- mobile;
- empty/unknown correto;
- estados disponíveis corretos;
- links especialistas;
- sem score geral;
- sem diagnóstico;
- sem mutation escondida;
- sem erro fatal.

Somente então F10 pode ser encerrada e F11 se torna elegível para abertura documental.
