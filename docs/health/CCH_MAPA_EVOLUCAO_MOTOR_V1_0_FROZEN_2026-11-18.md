# CCH — MAPA CONGELADO DE EVOLUÇÃO DO MOTOR · V1.0

**Status:** FROZEN — adendo de escopo, 18/11/2026 (America/Sao_Paulo)  
**Autoridade:** Camada Mestre / MAPA SOBERANO CCH v5.4 FROZEN (12/11/2026).  
**Base de implementação de referência:** CCH V10 (M3/M4/F13/F14/F22; F21 histórico; F19 execução).  
**Revisões deste documento:** somente mediante decisão explícita da Camada Mestre, com nova versão e histórico; nunca editar este mapa congelado silenciosamente.  
**F23:** não aberta e não implicitamente autorizada. Esta especificação não altera o mapa soberano v5.4.

## 1. Missão

Concluir a arquitetura de **prescrição adaptativa contínua** do CCH usando o programa M3 existente. A inteligência audita o histórico M4, consulta evolução F13, guarda decisões de revisão F14, respeita F21 e calibração F22, propõe estratégias, solicita o objetivo atual ao atleta e **gera somente rascunho versionado para revisão e publicação explícita**.

Não construir outro motor, outra fila ou catálogo paralelo. Não usar o construtor visual da Lovable. Código exclusivamente pelo GitHub. Respeitar RLS por atleta, invoker e histórico imutável.

## 2. Princípios invariantes

1. O nível real do praticante (`beginner/intermediate/advanced`) é independente da confiança da medição; falta de registro **não** converte Deividi ou Rafaela em iniciantes.
2. A agenda é **flexível**: sequência e recuperação por estímulo, não dias fixos, não limite universal de dez sessões.
3. O objetivo é escolha atual do atleta. O CCH recomenda opções explicáveis se ele não souber; não infere desejo de emagrecer ou diagnósticos pelo peso/aparência.
4. Comparações exigem exercício, unidade e, quando houver recomendação numérica de carga, **máquina comprovada na execução**. Sem identificação, apresentar lacuna, não inventar incremento.
5. Volume realizado ou frequência **não provam** tolerância, hipertrofia, causalidade ou dose ótima individual.
6. Dor e recuperação são autorrelatos para triagem de revisão, não diagnósticos. Aumento automático fica bloqueado diante de sinais contraditórios ou dados insuficientes.
7. Nenhum treino, versão publicada, fila ou registro histórico muda em razão de uma simulação ou recomendação. Nova versão é draft, publicação separada (M3 + gate F22).
8. A razão da proposta, fonte, confiança, restrições, objetivo escolhido e mudanças devem ficar disponíveis para auditoria e revisão humana.
9. Validação automatizada não equivale a homologação autenticada ou clínica.
10. Desenvolvimento avança sem aguardar meses de coleta, mas personalização comprovada exige uso real e acompanhamento longitudinal.

## 3. Entregas dentro do escopo (ordem vinculante)

### E1 — Modelo de decisão e simulador (executável agora)
- Motor puro com entradas tipadas: objetivo, experiência declarada, qualidade das evidências, histórico, recuperação, dor, agenda.
- Cenários sintéticos: avançado com poucos registros, iniciante com dados completos, progresso, estagnação, sinais conflitantes, mudanças de agenda, máquinas diferentes, falta de recuperação.
- Resultados determinísticos: objetivo sugerido, alternativas, motivos, bloqueios, necessidade de revisão, nenhuma publicação ou progressão obrigatória.
- Testes CI, sem consulta/escrita no banco real. Simulação é **prova lógica**, não avaliação de eficácia.

### E2 — Prescrição adaptativa por exercício (implementação futura dentro do mapa)
- Reutilizar M3/M4: repetições, séries, RIR, intervalos, progressão, substituições e prioridades.
- Identificar equipamento real e incrementos confirmados; técnica/revisão contextual quando disponível.
- Critérios explicitamente versionados; ajuste conservador e reversível em draft, com diff e justificativa.
- Sem duplicar filas, gerar sessões reais, autopublicar ou extrapolar cargas de máquinas diferentes.

### E3 — Periodização flexível orientada por objetivo
- Definir estrutura de estímulos e checkpoints condicionados à evolução/recuperação, sem obrigar semanas fixas.
- Preservar continuidade com 3, 4, 5 ou outros dias efetivos e pausas imprevistas.
- Comparar ciclo proposto versus ciclo realizado, períodos úteis e incertezas.

### E4 — Contraprova e governança
- Testes de dados faltantes, RLS e cruzamento de atletas, idempotência, F22 gate, sessão ativa, histórico voided, compatibilidade de esquema e alterações de versão.
- Prova de interface autenticada e jornada M3 → objetivo → alternativas → draft → revisão → publicação manual.
- Registrar estado **implementado**, **testado**, **homologado** e **disponível em produção** separadamente.

### E5 — Calibração longitudinal com dados reais (condicional)
- Medir relação entre prescrito e realizado, resposta e recuperação, sem atribuir causalidade por comparação simples.
- Critérios mínimos de múltiplas observações comparáveis; sem classificações arbitrárias de experiência.
- Ajustar recomendações à resposta real quando houver dados suficientes, mantendo o atleta no controle.

## 4. Estado de dados no congelamento

Leitura consultiva disponível na conversa: 17 sessões válidas concluídas; 215 séries de trabalho; 3 versões publicadas; 0 identidades de máquina confirmadas, 0 incrementos reais cadastrados e 0 janelas consolidadas de recuperação de 28 dias. Esses valores são **fotografia de auditoria**, não regra fixa nem dataset sintético.

Com esses dados é possível revisar execução, regularidade e parte do esforço registrado. Não é justificável afirmar aumento numérico individual de carga por máquina, tolerância ao volume ou eficácia de um protocolo superior para um atleta específico.

## 5. Critérios de aceite de cada etapa

- Prova de ausência de mudanças em atletas reais até autorização e publicação explícitas.
- Preservação de programa e histórico M3/M4/F21 e direitos por atleta.
- Recomendações explicadas, rastreáveis, editáveis e com dados insuficientes tratados honestamente.
- CI de decisões com casos de erro, sinais negativos e experiência independente da qualidade.
- Sem migração/execução de banco para E1; qualquer mudança futura de banco exige contrato/teste RLS.

## 6. Controle de alterações

Este documento é **FROZEN V1.0**. A implementação continuará em arquivos e PRs próprios. Qualquer expansão fora deste escopo deve resultar em nova proposta à Camada Mestre e nova versão do mapa, nunca alteração tácita.
