# Núcleo 2.0 — M5 | Laboratório visual isolado de alertas

**Data:** 12/11/2026  
**Mapa soberano:** Núcleo 2.0 V1.0; M5 — Supervisão e IA do Desenvolvimento  
**Natureza:** demonstração controlada; não é importação documental, diagnóstico real nem alteração de status.

## Comportamento implementado
Dentro da seção existente **Supervisão assistida — M5**, o botão **Abrir demonstração** abre um laboratório visual separado da consulta real M3/M4. A escolha de cenário gera **novos objetos em memória**, identificados como `DEMO-M5` e `DEMO-*`, executando o mesmo motor determinístico `inspectNucleoSupervision()` utilizado pela supervisão real.

Cinco opções:
- Divergência: evidência fictícia com `observed_state=divergente`.
- Bloqueio: frente fictícia marcada como bloqueada com motivo.
- Próxima ação: frente fictícia sem próxima ação.
- Fonte pendente: evidência fictícia `observado`.
- Simulação combinada: quatro alertas simultâneos, preservando tipo, origem, explicação e sugestão.

O título visível **“SIMULAÇÃO — DADOS FICTÍCIOS — NÃO É ALERTA REAL”**, a indicação do número de alertas sintéticos e os IDs `DEMO-*` distinguem categoricamente a área de ensaio da supervisão real. O botão **Fechar demonstração** oculta o laboratório, sem reiniciar ou adulterar os dados reais.

## Segurança e critérios
- Sem chamadas Supabase, GitHub, Drive, APIs externas, localStorage, SQL ou RPC na construção do cenário.
- Nenhum INSERT/UPDATE/DELETE, permissionamento, migration ou substituição das 42 evidências existentes.
- Os estados e os contadores oficiais continuam independentes; selecionar um cenário não atualiza o Kanban.
- O laboratório é renderizado dentro da seção previamente protegida da Central Visual, sem rota pública nova.
- As regras de homologação sintética já aprovadas continuam ativas; os novos testes exercitam o mesmo motor real e verificam os cinco cenários.
- A visualização no navegador publicado, inclusive alternar cenários, é um portão de homologação **separado** dos testes automatizados.

## Estado pretendido após CI
Código via GitHub, teste de fixtures, regressão do motor M5 e build. Não promover o estado oficial M5 a concluído automaticamente. Testar visualmente que cada opção exibe o tipo correspondente sem interferir no painel real de 7 frentes, 42 evidências e zero alertas iniciais.
