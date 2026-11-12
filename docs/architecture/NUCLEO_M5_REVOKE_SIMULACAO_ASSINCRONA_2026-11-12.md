# Núcleo 2.0 — M5 | Ensaio isolado de revogação de sessão e corrida assíncrona

**Data:** 12/11/2026. **Mapa soberano:** Núcleo 2.0 V1.0 — M5.

## Ponto técnico detectado

A sessão autorizada M5 podia iniciar três leituras sob RLS e, enquanto aguardava o retorno, receber um evento de mudança de autenticação ou de retorno à aba. A interface já apagava imediatamente os resultados antigos, porém o retorno tardio de uma consulta anterior deveria ser descartado com uma proteção explícita, independente da ordem de resposta da rede.

## Implementação

`src/lib/nucleo/supervision-request-guard.ts` contém um contador monotônico de requisições. Cada ciclo de leitura recebe um identificador; começar outro ciclo, receber evento de autenticação, retornar a uma aba visível ou desmontar a seção invalida imediatamente o identificador anterior.

No `NucleoSupervisionPanel.tsx` todas as continuações assíncronas verificam se o identificador ainda está autorizado a publicar. **Uma resposta antiga não pode repovoar os alertas depois de logout, revogação simulada ou troca de identidade.** Não houve mudança de tabelas, permissões ou no motor de recomendação.

## Teste de revogação isolada

`scripts/nucleo-m5-revocation-isolated.test.cjs` executa a implementação do guard em Node com promessas retardadas e dados sintéticos:
- Sessão com leitura válida de 42 provas sintéticas.
- Nova requisição concorrente substituindo a anterior.
- Revogação simulada enquanto a primeira consulta ainda está pendente.
- Resposta tardia anterior descartada, painel fechado.
- Nova consulta sob permissão revogada não exibe acervo.
- Troca de identidade e retorno da aba também invalidam respostas antigas.
- Nova autorização permite resultados **somente após nova leitura válida**.
- Verificações estáticas complementares comprovam ligação entre o componente e o guard e ausência de métodos de escrita.

A CI da M5 executa essa suíte junto aos testes existentes e build completo.

## Homologação RLS real precedente

Em transações somente leitura contra o Core, o papel `authenticated` com a identidade que possui `nucleo_manage` enxergou uma concessão, sete frentes e 42 evidências; uma identidade sem concessão enxergou zero concessões, zero frentes e zero evidências. Essas transações foram encerradas com `ROLLBACK` e não modificaram dados.

## Limite de comprovação

**Não foi revogada a única concessão produtiva**, nem se criou usuário falso na autenticação. O cenário assíncrono é isolado: comprova a proteção implementada contra respostas tardias; não substitui um navegador de ensaio real com permissão efetivamente concedida e depois revogada. Esse teste de ciclo real permanece pendente e deve usar uma identidade de homologação separada.

Também não se introduziu um monitor periódico de concessão: a M5 revalida em `Reavaliar`, alteração de autenticação e retorno à aba. Uma revogação externa enquanto o usuário mantém a aba aberta sem interagir não é instantaneamente refletida na tela — embora o servidor aplique RLS nas próximas solicitações. Não alegar revogação visual imediata não testada.

## Estado e patrimônio

Sem uso do construtor Lovable, DDL, migration, INSERT/UPDATE/DELETE, grants, alterações de status, importação ou exclusão das 82 páginas locais. M5 permanece `em_validacao`; o encerramento depende de homologação real da revogação em sessão com identidade de ensaio e critérios da Camada Mestre.
