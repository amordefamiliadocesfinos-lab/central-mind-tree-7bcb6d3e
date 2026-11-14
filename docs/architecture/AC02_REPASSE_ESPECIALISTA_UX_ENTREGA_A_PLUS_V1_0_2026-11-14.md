# REPASSE ESPECIALISTA UX — AC-02 / Núcleo 2.0 V1.3 / Entrega A+

**Data:** 14/11/2026  
**Natureza:** contrato técnico de apresentação, não aprovação visual nem execução de interface.  
**Autoridade:** Camada Mestre; fonte soberana continua Mapa V1.3 e critérios CA-01–CA-29.

## 1. Componentes reaproveitáveis — sem duplicação
- Identidade e proveniência global: `src/lib/nucleo/ac02RegistryContract.ts` → fonte canônica compartilhada `supabase/functions/_shared/nucleo/ac02-registry-contract.ts` (#806).
- Consulta protegida do Núcleo: `supabase/functions/nucleo-knowledge-read/index.ts` (#807, #813, #814). `module_code` obrigatório, `include_ac02=true`, `include_assumption_export=true` opcional. Requer JWT, `nucleo_manage`, RLS; não dar esse privilégio ao destinatário para apenas conhecer o contexto.
- Rascunho exportável: `src/lib/nucleo/ac02AssumptionExport.ts` → `ac02-assumption-export.ts` (#813/#814).
- Conferência e seleção transitórias: `src/lib/nucleo/ac02ControlledDistribution.ts` → `ac02-controlled-distribution.ts` (#815).
- Manifesto de integridade: `src/lib/nucleo/ac02PackageManifest.ts` → `ac02-package-manifest.ts` (#818), hash SHA-256 dos bytes exatos UTF-8.
- Projeção de histórico: `src/lib/nucleo/ac02HandoffLedger.ts` → `ac02-handoff-ledger-contract.ts` (#817/#819). **Tabela ainda proposta, não existente no Cloud oficial**.

## 2. Jornada visual futura, sob responsabilidade exclusiva de UX
1. **Registro Mestre:** identidade, GitHub, projeto Lovable e Supabase Cloud integrado; diferenciar *aprovado pela Camada Mestre*, *checado no provedor*, *não verificado*, *vencido* e *divergente*. Nunca chamar merge de deploy.
2. **Contexto do módulo:** FM-03/08/09, frentes M3 e evidências M4 com indicação de proveniência e limites; FM-08 comum não significa método e ecossistema distintos; não certificar mandato por aproximação.
3. **Preparar assunção:** chamar a consulta protegida do lado gestor, mostrar o rascunho completo, pendências e dados que NÃO serão incluídos. Não inferir entrega a partir do retorno JSON.
4. **Revisar e selecionar:** selecionar `novo_chat_ia` ou `sucessor_humano`, módulo, identidade destinatária somente se comprovável, e exigir cinco confirmações explícitas. Se expiradas, solicitar nova revisão.
5. **Integridade:** calcular e conferir `Ac02PackageManifest`; mostrar SHA-256, tamanho em bytes, versão e status `local_computed_not_authenticated`. **Hash correspondente não significa assinatura/autoria/entrega.**
6. **Ação humana de cópia:** preparar cópia/download sob decisão explícita. Não enviar automaticamente, conectar contas, criar mandato ou marcar `recebido` ou `aceito`.
7. **Linha do tempo:** quando o ledger for autorizado e existir, consultar sob RLS, validar cadeia, classificar eventos como **declaração do gestor** ou **confirmação humana do destinatário**; renderizar `cadeia_inconsistente` como erro/alerta sem etapa final promovida.

## 3. Estados e comunicação visual
| Estado | Proveniência | Requisito de apresentação |
|---|---|---|
| preparado | pacote/gestor | preparação não equivale a disponibilização |
| disponibilizado | evento declarado | pacote acessível segundo declaração; não prova leitura |
| entregue | evento declarado | não confundir com confirmação do destinatário |
| recebido | destinatário humano autenticado | não pressupor aceitação |
| aceito | destinatário humano autenticado | não equivale a homologação do Núcleo |
| falha | evento próprio | mostrar fonte, hora e ressalvas |
| expirado | evento próprio após prazo | não deduzir automaticamente sem evento |
| retificado | novo evento append-only | preservar evento anterior e versão corrigida, sem reescrever |

O contrato de timeline só projeta **metadados de uma leitura previamente autorizada**, não prova autenticidade por si mesmo. Em cadeias inconsistentes, `latest=null`. Para novo chat IA, não há identidade Supabase nem confirmação de recebimento/aceite certificada; UX deve mostrar o limite.

## 4. Permissões, privacidade e integrações proibidas
- UX não cria tabelas, migrations, políticas, GRANT, triggers ou `service_role`.
- Não armazenar JWT, cookies, links privados, corpos de documentos ou segredos na exportação.
- Rascunho não cria acesso ao Drive, GitHub, Lovable ou Supabase do especialista.
- Comprovante da #815 é `recordedInCore=false`, `delivered=false`, `received=false`.
- A migration do ledger em `docs/architecture/proposals/NUCLEO_AC02_HANDOFF_APPENDONLY_PROPOSTA_NAO_APLICAR.sql` só foi aplicada em CI descartável; implantação no Lovable Cloud requer nova autorização.
- Não criar segundo Núcleo, biblioteca paralela ou antecipar a Entrega B.

## 5. Dependências e portões de aceite
**Liberado para UX:** desenhar/aprimorar apresentação e jornada baseada nos contratos consultivos atuais, sem representar eventos produtivos ainda inexistentes.

**Pendente:** implantar revisionamento atual da Edge Function; autorizar/aplicar eventual ledger; verificar identidade, RLS e segregação 200/401/403; teste de cópia/recepção no chat sucessor; validar emissão de manifesto a partir de fonte realmente autenticada; homologação funcional/visual humana.

**Prova final esperada posteriormente:** especialista sucessor conhece identidade, infraestrutura, fontes permitidas, escopo e checkpoint reais sem receber credenciais nem presumir mandato. Um texto copiado ou JSON bem formado sozinho não satisfaz o aceite.
