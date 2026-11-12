# Núcleo 2.0 — M5 | Protocolo de homologação dos alertas com dados sintéticos

**Data:** 12/11/2026  
**Mapa:** Núcleo 2.0 V1.0, M5 — supervisão e IA do desenvolvimento.  
**Natureza:** homologação técnica isolada do motor determinístico M5; **não é teste com alterações em produção**, nem homologação de um modelo de IA.

## Objeto e isolamento

A suíte `scripts/nucleo-m5-alertas-homologacao.test.cjs` importa a implementação real de `src/lib/nucleo/supervision.ts` em ambiente Node isolado, usando apenas registros **fabricados para o teste**, sem endereço de rede, chave Supabase, usuário, sessão, navegador ou cliente GitHub.

Não são criados, editados ou excluídos registros em `nucleo_development_evidence`, `nucleo_development_workstreams` ou `nucleo_development_events`. Nenhum dos 42 registros reais é lido ou alterado pelo teste.

## Critérios de aceite

O teste verifica, com assertivas automatizadas:

1. Base íntegra não produz falso alerta.
2. Divergência isolada gera alerta com ID de origem e orientação de investigação.
3. Divergências múltiplas se agrupam preservando os IDs.
4. Bloqueio declarado exibe o motivo e recomenda decisão humana.
5. Bloqueio sem motivo não fabrica explicação.
6. Próxima ação ausente gera recomendação, sem preenchimento automático.
7. Espaços em branco equivalem a próxima ação vazia.
8. Evidência `observado` é classificada como pendente de conferência.
9. Evidência `nao_verificado` também exige conferência.
10. Fontes pendentes são agrupadas com os IDs originais.
11. Frente declarada `concluido` sem prova técnica verificada gera aviso, não reclassificação.
12. Frente concluída com prova verificada não é invalidada por inferência.
13. Divergência, bloqueio, ação vazia e fonte pendente podem coexistir preservando tipos distintos.
14. Prova de outra frente não contamina o diagnóstico.
15. Dependência apenas é considerada quando está explicitamente cadastrada.
16. Dependência com destinatário inexistente não é inventada.
17. Registro-pai `modulo` não é tratado como frente.
18. Cenário com 42 provas **sintéticas** verificadas apresenta zero alertas.

Em **todos** os cenários há assertivas de não mutação das entradas, `informationalOnly=true`, origem/justificativa/ação dos alertas e horário de avaliação fixo, sem inferência de status ou porcentagens de conclusão.

## Evidência de execução e fronteira

O workflow `.github/workflows/nucleo-m5-supervision.yml` passa a executar essa suíte além dos testes anteriores e do build do Painel Central.

A aprovação da suíte comprova as **regras do motor em condições sintéticas**. Não comprova automaticamente que uma pessoa sem `nucleo_manage` seja bloqueada em um navegador real após revogação, que um alerta seja renderizado visualmente em cada estado, nem que dados externos estejam atualizados. Essas verificações devem continuar separadas, com segurança e sem adulteração dos dados produtivos.

**Gates para conclusão deste marco:** GitHub Actions verde na PR, nenhuma mutação produtiva, preservação de 42 evidências / 7 registros / 12 eventos e documentação audível. A frente M5 não será marcada `concluido` por causa do teste.
