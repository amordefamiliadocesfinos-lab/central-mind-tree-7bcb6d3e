# Núcleo V1.2 — Entrega A+ — CA-13/17: Reconciliação documental da Ficha Viva CRM

**Corte:** 14/11/2026. **Mapa soberano:** Núcleo 2.0 V1.2; piloto CRM. Não constitui novo mapa, mandato ou homologação.

## Fontes originais realmente consultadas

1. `BASE_DE_CONHECIMENTOS_FINAL_WINDOWS_ATUALIZADA_2026-10-22_V3_ALFAJOR_60G.zip`, `BASE_FINAL/04_PAINEL_CENTRAL/02_ESTADOS_VIGENTES/PCL-MST-ESTADO-CRM-V1.0.txt` — estado de 03/10, autodeclarado vigente. Declara cockpit comercial em uso, preserva 33 Resultados, 19 Próximas Ações e distinções entre Resultado, Etapa, Próxima Ação e estado operacional. A própria fonte não confirma estado técnico ao vivo.
2. Mesmo ZIP, `BASE_FINAL/70_FONTES_E_EVIDENCIAS/07_CRM_E_COMERCIAL_HISTORICO/DOCUMENTO_05_03_ARQUITETURA_OPERACIONAL_CRM_V1_0.txt` — consolidou a hierarquia documental; não substitui originais, proíbe mudança silenciosa de status e identifica conflito formal de 09.02.
3. `ATENDIMENTO CRM ETAPAS.zip`: Documento Mestre V1.0; bibliotecas oficiais 01–08 V1.0 homologadas; Matriz 09.01 V1.1 homologada; 09.02 Resultados e 09.03 Próximas Ações V1.1 com cabeçalhos **REFINADA — PRONTA PARA HOMOLOGAÇÃO**; 09.04 Transições V1.0 e 09.05 Prioridade V1.0 homologadas. O 09.04 referencia o 09.02 como homologado; não alterar o cabeçalho original por inferência.

## Hierarquia e limites de autoridade

Processo Comercial → Bibliotecas 01–08 → Matriz 09.01 → Dicionários 09.02/09.03 → Transições 09.04 → Prioridade 09.05 → Implementação técnica. A implementação não redefine o processo e não deve converter códigos documentais automaticamente em enum ou migration.

O estado histórico de CRM e a autoridade da arquitetura comercial não comprovam que o especialista funcional atual tenha mandato. `CRM 7` é referência histórica no mapa UX02 de 16/10; não identifica titular atual nem autoridade normativa. O Core no corte anterior tinha **0 registros de mandato** e **0 revisões FM**; não preencher por inferência.

## Alteração na Entrega A+

`src/lib/nucleo/crmAuthoritySourcesV12.ts` indexa **nove grupos de fontes**, com nome, versão, status literal do arquivo, finalidade e pendência, **por localizador no ZIP original** — nenhum conteúdo copiado ao banco.

A Ficha Viva CRM `NucleoModuleKnowledge.tsx` passou a permitir expansão contextual dessas referências nas seções FM-01/03/07/08, junto do limite de autoridade do especialista. Nenhuma alteração na Ficha Viva persistida, mandato, RLS, CRM operacional, mapa congelado ou Entrega B.

## Gates CA-13 e CA-17

- **CA-13:** referência documental original e hierarquia integradas ao ambiente. Ainda exige revisão humana e gravação autenticada de ao menos uma Ficha Viva completa, com fontes e método/autoridade confirmados, e aceites funcionais correspondentes.
- **CA-17:** identidade funcional e referência histórica explicitadas, mas a certificação de método, especialista e transferência precisa de decisão da Camada Mestre e registro formal; nunca gerar `certificacao` por interpretação de chat ou nome de arquivo.
- **CI:** teste determinístico confere identificadores, estados conflitantes, ausência de certificação, integração da UI. Build não representa aceite real.

Não repetir investigação do acervo original ou criar novo inventário paralelo; aproveitar estas referências e verificar somente decisões posteriores que possam alterar vigência.