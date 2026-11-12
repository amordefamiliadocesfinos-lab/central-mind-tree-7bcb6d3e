# Núcleo 2.0 — atualização de governança da M5 para Em validação

**Data:** 12/11/2026  
**Mapa soberano:** Núcleo 2.0 V1.0, M5 — Supervisão e IA do Desenvolvimento.  
**Origem da decisão:** autorização do proprietário após homologação sintética e visual da primeira entrega.

## Alteração executada no Core oficial

A frente `NUC-M5` (ID `703b54e4-89ea-473c-b9c8-51606b0c503a`) passou de **`planejado`** para **`em_validacao`**, com `evidence_state=comprovada` exclusivamente para a implantação técnica inicial.

A transação de atualização usou preflight do patrimônio e verificou o registro anterior. O mecanismo de auditoria M3 produziu evento `alterado` contendo transição `planejado` → `em_validacao` em `2026-11-12 19:30:50.811119+00`.

Foram atualizados os campos de descrição, próxima ação, critérios de aceite e nota de evidências para descrever os fatos já demonstrados. Nenhuma frente foi promovida a `concluido`.

## Evidências da entrega inicial M5

- [PR #655](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/655): supervisão assistida integrada à Central Visual, com consulta sob RLS e regras de leitura.
- [PR #659](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/659): homologação de 18 cenários sintéticos e preservação das entradas.
- [PR #662](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/662): laboratório visual de cinco cenários fictícios, com indicação explícita de simulação.
- Capturas da aplicação publicada mostram a seção Supervisão Assistida (sete registros M3, 42 evidências M4, zero alertas reais) e a simulação combinada com quatro alertas sintéticos separados e explicados.
- Os testes automatizados e builds das três entregas foram aprovados. Capturas são evidência de exibição, não comprovação do clique de `Reavaliar` nem do comportamento de revogação em sessão real.

## Limites e critérios ainda pendentes

**Comprovado:** instalação e apresentação visual da supervisão read-only, motor determinístico, laboratório separado e alerta sintético explicado com referência à origem.

**Não comprovado integralmente:** execução funcional do botão `Reavaliar` em navegador real, revogação de capacidade durante sessão ativa, validação de condições adversas com contas reais e eventual supervisão por LLM com contrato autorizado. Não declarar IA autônoma implementada.

**Próxima ação oficial:** validar comportamento da supervisão com conta autorizada, conferir revogação em contexto controlado sem alterar evidências, aperfeiçoar rastreabilidade e delimitar qualquer autonomia futura com revisão humana.

## Estado posterior de integridade (consulta ao Core)

| Patrimônio | Quantidade |
|---|---:|
| Frentes `NUC` e M0–M5 | 7 |
| Evidências técnicas | 42 |
| Eventos históricos M3 | 13 |
| Referências Google Drive M2 | 3 |
| Documentos M1 importados | 0 |
| Concessões `nucleo_manage` ativas | 1 |

A M4 permanece `em_validacao`. A M5 agora também está `em_validacao`. Não foram criadas migrations, grants, dependências presumidas nem alterações nas 82 páginas locais.

**Parecer:** avanço da governança M5 justificado pelas evidências existentes; manter homologação final condicionada aos critérios restantes, preservando o escopo congelado.
