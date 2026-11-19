# CCH E3 — primeira camada pura de periodização flexível (escopo congelado V1.0)

**Autoridade:** Mapa soberano v5.4 FROZEN e mapa de evolução V1.0 FROZEN (não editar). O proprietário autorizou em 19/11/2026: "DESTRAVE E CONTINUE NO ESCOPO".

## Separação da decisão de progresso
A E2 possui código, contratos PostgreSQL/F22 e navegador isolado aprovados. Sua **homologação na sessão autenticada oficial continua parcial** (Work viu `data-cch-build-commit=unknown`; a correção de identidade por fingerprint está integrada na PR #978, mas a prova remota ainda falta). A decisão de prosseguir desenvolvimento da E3 **não é** a declaração de que a E2 está homologada. O gate de produção/publicação de atleta permanece protegido.

## Entrega E3-A — módulo puro, não integrado ao sistema real
`periodizationFlexibleE3.ts` recebe objetivo escolhido, nível informado (sem rebaixamento por falta de dados), qualidade, recuperação/dor, sinais adversos, versão de origem, códigos de sessões previstas no M3 e sessões reais válidas do M4/F21 **fornecidas pelo chamador**, sem acesso à base.

Retorna um relatório **consultivo**, sem mutação, com:
- plano de estímulos por códigos existentes e sequência observada, sem calendário semanal obrigatório;
- métricas descritivas de sessões, séries e cobertura, exigindo datas e valores disponíveis para conclusões numéricas;
- checkpoints por próxima sessão comparável, alteração de objetivo, sintomas ou disponibilidade, sem contador arbitrário universal;
- alternativas de consolidar/revisar recuperação e apenas considerar progressão seletiva se evidências permitirem;
- bloqueios explícitos para dor, recuperação insuficiente, sinais negativos, origem divergente e incerteza;
- sinalização obrigatória `draftOnly/manualPublicationRequired/generatesQueue:false`.

Não se criou outro catálogo, fila, programa, banco, RPC, calendário, prescrição ou registro histórico. **Nenhum treino real nem a E2 publicada foram alterados.**

## Critérios do próximo passo E3-B
Somente após CI verde, revisar ligação de dados M3/M4/F21 com RLS; apresentar estudo na interface em modo consultivo sem autorizar escrita; comparar ciclos propostos vs realizados com métricas disponíveis; manter publicação exclusiva no gate F22. **Não abrir F23**. Não declarar efeitos clínicos ou personalização comprovada.

### Testes
Fixtures sintéticas com 3,4,5,7 sessões, pausas longas, agenda variável, ausência de dados, voided, duplicação, sessão não concluída, dor, recuperação, divergência de versão, objetivo ainda não escolhido e atleta avançado com dados limitados.
