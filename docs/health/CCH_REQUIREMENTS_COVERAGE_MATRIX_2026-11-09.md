# CCH / SAÚDE — MATRIZ DE COBERTURA DOS REQUISITOS FUNCIONAIS

**Data:** 09/11/2026  
**Status:** COBERTURA DE DESENVOLVIMENTO CONSOLIDADA  
**Base:** `main@a7380e872baf0b9e82ff749955d160b37cd96af0`

> Esta matriz mede cobertura de arquitetura/código. Não transforma testes, banco ou deploy pendentes em homologação operacional.

## 1. Perfil e contexto do usuário

| Requisito | Cobertura | Camada |
|---|---|---|
| Perfil completo | ✅ | M1 |
| Peso/altura/métricas | ✅ | M1 + M8 |
| Objetivo principal | ✅ | M1 |
| Fase atual | ✅ | M1 |
| Preferências | ✅ | M1 |
| Equipamentos/local | ✅ | M1/M3 |

## 2. Treino e periodização

| Requisito | Cobertura | Camada |
|---|---|---|
| Programa de treino | ✅ | M3 |
| Prioridades musculares | ✅ | M3 |
| Flexibilidade de sessões | ✅ | M3/M4 |
| Execução real | ✅ | M4 |
| Histórico factual de treino | ✅ | M4 |
| Visualização histórica | ✅ | F17 |
| Periodização orientada por objetivo/fase | ✅ estrutural | M1/M3 |
| Replanejamento humano | ✅ | F14 |

## 3. Alimentação

| Requisito | Cobertura | Camada |
|---|---|---|
| Plano nutricional | ✅ | M5 |
| Metas energia/macros | ✅ | M5 |
| Diário alimentar | ✅ | M5 |
| Receitas | ✅ | M5 |
| Estado nutricional | ✅ | M6 |
| Decisão nutricional | ✅ | M7 |
| Histórico gráfico | ✅ | F17 |
| Relatório longitudinal | ✅ | F15 |

## 4. Evolução corporal

| Requisito | Cobertura | Camada |
|---|---|---|
| Peso e circunferências | ✅ | M8 |
| Gordura/composição quando medida | ✅ | M8 |
| Histórico | ✅ | M8 |
| Fotos privadas | ✅ | M8 |
| Protocolo guiado de fotos | ✅ | M8 |
| Linha do tempo visual | ✅ | M8 |
| Tendências | ✅ | M8 |
| Gráficos | ✅ | F17 |

## 5. Sono e recuperação

| Requisito | Cobertura | Camada |
|---|---|---|
| Sono | ✅ | M9A |
| Check-ins de recuperação | ✅ | M9A |
| Estados 7/14/28 | ✅ | M9A |
| Histórico gráfico | ✅ | F17 |
| Integração em decisão global | ✅ estrutural | F11 |

## 6. Exames e biomarcadores

| Requisito | Cobertura | Camada |
|---|---|---|
| Registro de exames | ✅ | M9B |
| Biomarcadores | ✅ | M9B |
| Segurança/isolamento | ✅ | M9B |
| Sem diagnóstico automático | ✅ | governança |

## 7. Integração CCH

| Requisito | Cobertura | Camada |
|---|---|---|
| Dashboard integrado | ✅ | F10 |
| Motor integrado | ✅ código | F11 |
| Jornada real completa | ✅ código | F12 |
| Evolução longitudinal | ✅ código | F13 |
| Replanejamento assistido | ✅ código | F14 |
| Relatórios | ✅ código | F15 |
| Lembretes/rotina | ✅ código | F16 |
| Analytics/gráficos | ✅ código | F17 |

## 8. Requisitos transversais

| Requisito | Cobertura |
|---|---|
| Mobile-first | ✅ especificado/implementado |
| Histórico preservado | ✅ |
| Supersession/void quando aplicável | ✅ |
| unknown != zero | ✅ |
| Sem score global | ✅ |
| Sem causalidade automática | ✅ |
| Sem autoajuste silencioso | ✅ |
| RLS nos módulos persistentes | ✅ em arquitetura/código |
| Git/GitHub como fonte soberana | ✅ |
| Lovable Builder não usado como autor | ✅ diretriz |

## 9. Lacunas que permanecem

As lacunas atuais são principalmente **operacionais**, não novas frentes funcionais:

- TESTES MT adiados;
- Gate B pendente para migrations ainda não aplicadas;
- Gate C/deploy pendente onde aplicável;
- homologação real F11→F17 pendente;
- prova visual mobile produção F10 ainda registrada;
- validação de dados reais suficientes para F13/F14/F15/F17;
- hardening contínuo de UX, acessibilidade, performance e observabilidade.

## 10. Conclusão

Os requisitos funcionais originais conhecidos do CCH estão cobertos em arquitetura/código até F17.

Não foi identificado, nesta reconciliação, um requisito funcional conhecido que justifique abrir F18.

Qualquer F18 futura deve nascer de:
- requisito novo do usuário;
- achado objetivo de uso;
- necessidade técnica que não caiba em hardening/manutenção;
- nova versão formal do Mapa Soberano.
