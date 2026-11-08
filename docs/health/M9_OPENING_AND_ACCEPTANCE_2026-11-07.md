# M9 — OPENING REPORT & ACCEPTANCE CONTRACT — 2026-11-07

## Estado

**ARQUITETURA + DESENHO TÉCNICO v1 FECHADOS — IMPLEMENTAÇÃO AINDA NÃO INICIADA**

Base:
`main@4d6ebbeb71f39b9f3c39a07604e6e1f6a2fe54ae`

Branch:
`docs/health-m9-architecture-20261107`

Nenhum código funcional, migration, alteração de banco, deploy ou dado real de Saúde faz parte desta abertura.

## Pré-condição

M8 Body Evolution:
- integrada;
- banco aplicado;
- deploy concluído;
- homologação visual concluída em sessão autenticada.

A condição de entrada prevista pelo Mapa Soberano v2 foi satisfeita.

## Herança concluída

Fontes especialistas lidas e consolidadas:
- `04 — SONO E RECUPERAÇÃO`;
- `05 — SAÚDE — EXAMES E BIOMARCADORES`;
- `ARQUITETURA_SISTEMA_SAUDE_DESENVOLVIMENTO_INDIVIDUAL_v1`;
- `CCH_MAPA_SOBERANO_E_METODO_DE_TRABALHO_v2.md`;
- arquiteturas M7/M8 como referência de separação fact/state/decision/action.

Nenhum dado pessoal de Saúde foi necessário para definir esta arquitetura.

## Fronteira oficial M9

### M9A — Sleep & Recovery

Responsável por:
- fatos de sono;
- fatos subjetivos de recuperação;
- dados de dispositivos com origem;
- estado longitudinal 7/14/28;
- cobertura/confiança/reason codes;
- histórico e correções não destrutivas.

Não decide alteração de treino/dieta.

### M9B — Exams & Biomarkers

Responsável por:
- documentos clínicos fornecidos;
- exames/coletas;
- biomarcadores;
- unidades e intervalos originais;
- sinais fisiológicos fornecidos;
- histórico longitudinal;
- comparabilidade estrutural;
- flags estruturais sem diagnóstico.

Não produz diagnóstico nem conduta.

## Regras transversais obrigatórias

- `unknown != zero`;
- fato != estado != interpretação != hipótese != decisão != ação;
- fonte/origem é obrigatória quando conhecida;
- ausência de campo não autoriza inferência;
- correção preserva histórico;
- algoritmo/parameter set de estado deve ser versionado;
- RLS deny-by-default;
- anon sem acesso;
- cross-athlete obrigatório;
- documentos/mídia clínica privados;
- nenhum dado detalhado de Saúde é fonte de verdade em módulos externos;
- conexão intermódulo não significa causalidade;
- IA não é autoridade diagnóstica nem motor decisório clínico.

## Critérios de aceitação documental

M9 pode avançar da arquitetura para implementação somente quando:

1. M9A e M9B possuírem contratos versionados na branch;
2. fronteiras entre os dois domínios estiverem explícitas;
3. fatos, estados e futuras decisões estiverem separados;
4. `unknown != zero` estiver coberto por estados/reason codes;
5. correção por supersession/void estiver definida;
6. RLS, cross-athlete e Storage privado estiverem previstos;
7. M9A não transformar wearable em verdade clínica;
8. M9B preservar valor/unidade/referência/fonte original;
9. M9B não forçar janelas 7/14/28 para exames esparsos;
10. não existir alteração automática de treino, dieta, medicamento ou tratamento;
11. rota/UI futura for mobile-first;
12. nenhuma implementação usar Lovable Builder/agent como autor do CCH;
13. a `main` permanecer reconciliada antes da implementação.

## Critérios de aceitação futuros — implementação

Quando a implementação for autorizada, exigir no mínimo:

### Banco/Testes
- migrations versionadas;
- TESTES MT primeiro;
- idempotência onde houver `client_event_id`;
- constraints de integridade sem fingir diagnóstico;
- RLS habilitado em todas as tabelas;
- anon sem grants indevidos;
- authenticated somente no mínimo necessário;
- cross-athlete negative tests;
- `search_path` fixo em RPCs privilegiadas;
- rollback/documentação quando aplicável.

### M9A
- período de sono distingue tempo na cama de sono efetivo;
- entradas parciais funcionam;
- 7/14/28 preservam unobserved/sparse/partial/complete conforme contrato final;
- wearables carregam origem;
- ausência não vira zero;
- histórico de correção preservado.

### M9B
- documento original privado quando fornecido;
- resultado preserva valor/unidade/referência/flag original;
- resultado não numérico é suportado;
- aliases não apagam nome original;
- comparabilidade pode resultar em `unknown/not_comparable`;
- correção preserva exame anterior;
- nenhuma interpretação diagnóstica automática.

### Frontend
- mobile-first;
- sem erro fatal;
- loading/error/empty states;
- dados desconhecidos aparecem como desconhecidos;
- origem/confiança visíveis quando relevantes;
- sem exposição de documentos por URL pública.

### CI/Gates
- `npm ci`;
- lint Health;
- build completo;
- diff restrito;
- PR Draft;
- Gate A;
- Gate B;
- pós-check produção;
- Gate C;
- homologação real.

## Decisões arquiteturais resolvidas

As sete decisões que bloqueavam o desenho técnico foram congeladas em:

`docs/health/M9_ARCHITECTURAL_DECISIONS_V1.md`

Resultado:

1. nomes finais de tabelas/RPCs definidos;
2. cobertura M9A definida por dimensão, com suficiência 5/7, 10/14 e 20/28;
3. escalas subjetivas 1–5 opcionais definidas, preservando texto bruto e direção semântica;
4. catálogo mínimo de wearable definido;
5. catálogo/aliases de biomarcadores definido, com LOINC/UCUM opcionais e versionados;
6. rotas finais definidas: `/saude/recuperacao` e `/saude/exames`;
7. extração documental definida como staging + revisão + confirmação antes de fato clínico canônico.

A arquitetura M9A/M9B está **apta para desenho técnico**.

Isso não autoriza migration, banco, merge, deploy ou escrita de dados reais.

## Próxima ação permitida

A PR Draft documental já está aberta e a revisão arquitetural foi concluída.

Entregáveis técnicos concluídos:
- `M9_TECHNICAL_DESIGN_V1.md`;
- `M9_SECURITY_RLS_MATRIX_V1.md`;
- `M9_TEST_PLAN_V1.md`;
- `M9_MOBILE_UI_SPEC_V1.md`.

O desenho define migrations/RPCs lógicas, RLS/grants/cross-athlete, casos de teste e UI mobile sem criar migration real, sem executar SQL e sem alterar código funcional.

Revisão final documental:
- concluída;
- inconsistências de estado reconciliadas;
- identidade de check-ins endurecida;
- void de documento clínico explicitado;
- correção de biomarcadores congelada por supersession/void do relatório;
- contratos de segurança global de catálogo esclarecidos.

Próxima decisão de governança:
- **Gate A da PR #487**.

A implementação continua bloqueada. Após merge autorizado da documentação, deve nascer em branch própria a partir da `main` então vigente, com migrations reais geradas pelo CLI e TESTES MT primeiro.
