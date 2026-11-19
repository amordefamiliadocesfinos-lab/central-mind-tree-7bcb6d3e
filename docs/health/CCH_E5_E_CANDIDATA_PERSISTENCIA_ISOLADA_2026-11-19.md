# CCH E5-E — candidata de persistência e governança em laboratório isolado

**Autoridade:** Camada Mestre (deliberações de 19/11/2026), Mapa CCH v5.4 FROZEN e Evolução do Motor V1.0 FROZEN. **PR #999 em draft, sem merge; Issue #966 aberta; F23 não iniciada.**

## 1. Escopo e bloqueios

A candidata SQL está em `supabase/candidates/health_cch_e5e_persistence_candidate.sql`, **fora** de `supabase/migrations`. A única execução permitida é PostgreSQL 17 descartável com identidades e políticas fictícias. Nenhuma mudança foi autorizada no banco real, em programas de Deividi/Rafaela, na interface, nos consentimentos reais ou na prescrição automática. Um CI verde não é homologação de segurança, clínica, jurídica ou produtiva.

## 2. Consentimento E5 — contrato vigente na candidata

A tabela M1 `health_consents` permanece append-only: os cinco tipos existentes são preservados e `e5_personalized_review` é aceito **somente na candidata**. A política INSERT é substituída, e não acrescentada por OR. O aceite E5 requer identidade autenticada do próprio atleta em `health_athletes.auth_user_id`, `actor_auth_user_id=auth.uid()`, `details.contract=cch-e5-consent-v1` e `details.explicit_action` como booleano JSON verdadeiro. Um proprietário de cadastro, treinador ou representante com privilégios de gestão não pode conceder E5 em nome do atleta; ausência de vínculo de login não autoriza E5. Horários são carimbados pelo servidor.

**Assinatura correta:** `health_cch_e5_has_explicit_consent(p_athlete_id uuid)` — **não** recebe versão arbitrária. O banco consulta exclusivamente a política com estado `active` no registro protegido `health_cch_e5_policy_registry`; só retorna verdadeiro quando a última decisão do atleta é `granted`, única, vinculada àquela versão e sem revogação/negação posterior ou empate. Sem política aprovada ativa, a leitura é negativa. `e5-lab-v1` e `e5-lab-v2` são identificadores **exclusivos dos testes**.

## 3. Governança documental da política ativa — proposta, não aprovação jurídica

A aprovação formal exige um **documento canônico integral**, identificável por versão, conteúdo e SHA-256 calculado a partir dos bytes UTF-8 com quebras de linha LF (`\n`), sem normalização silenciosa ou texto variável. O hash é um controle de **integridade**, não prova de legalidade nem de aprovação por pessoa autorizada.

Contrato de governança proposto:
- `policy_version` único e imutável, `policy_document` canônico legível, `policy_digest` SHA-256 verificável do conteúdo exato
- `approved_by_auth_user_id`, `approval_reference`, `approved_at` e `effective_at`, com aprovação e data de vigência rastreáveis
- `status` `active` ou `retired` com **no máximo uma** política ativa; a substituição deve ser operação de autoridade controlada, transacional e auditável
- nenhuma escrita de política concedida a `authenticated`; a existência do registro **não autoriza** quem pode criar ou ativar versões
- uma política retirada não pode ser selecionada por parâmetro do cliente; nova política exige nova decisão explícita do atleta

**Pendência de autoridade:** texto integral definitivo, aprovador legítimo, procedimento de ativação/retirada, verificabilidade externa do registro de aprovação, retenção e tratamento de menores ainda não foram homologados. O documento de proposta abaixo **não deve ser registrado como política ativa real**.

## 4. Recuperação pós-sessão e retificação — contrato M4

M4 usa `health_workout_events` com `event_type=note`, `source=user`, `contract=cch-e5-session-review-v1`, `explicit_confirmation=true`, recuperação `good|poor|unknown` e sintomas `none|pain|unknown`. Sessão: `completed` e `record_status=active`; ator: o próprio atleta autenticado. O banco atribui os horários de servidor, valida autoria, vínculo e payload; índice parcial impede duplicar evento raiz ou criar dois sucessores do mesmo predecessor.

**Não é mais correto dizer que existe uma única nota por sessão.** Há uma *raiz única* e uma cadeia de **retificações imutáveis** em eventos novos com `replaces_event_id` referenciando o evento imediatamente anterior. Eventos antigos permanecem para auditoria.

A leitura consultiva E5-E deve selecionar **somente a última ponta válida** dessa cadeia. Sem raiz, com ciclos, ramificações, elos externos, autores diferentes, payloads inválidos, estado de sessão inelegível ou consentimento E5 não vigente, deverá falhar fechada: retornar nenhuma revisão autorizada, nunca presumir recuperação boa. Leituras diretas do M4 e integrações E5-B/E5-D não são ativadas por esse contrato; uma integração futura precisa homologar as interfaces.

## 5. Proposta única de texto informado de consentimento E5 (ainda não aprovada)

**Título provisório:** Consentimento para revisão individualizada de treinamento — CCH E5

> **Para que servirá:** Ao aceitar, você autoriza o CCH a utilizar seus registros de treino e evolução, incluindo exercícios, séries, cargas, repetições, esforço percebido, histórico de sessões, equipamentos declarados e informações de recuperação ou sintomas que você informar, para preparar análises e sugestões individualizadas de treinamento, que ainda dependerão de revisão humana.
>
> **Quais dados:** O CCH utilizará apenas os dados relacionados a essa finalidade e vinculados ao seu perfil autorizado. Informações não registradas serão tratadas como desconhecidas. Relatos de dor e sintomas não representam diagnóstico.
>
> **Quem poderá acessar:** Você e os profissionais ou operadores que tiverem acesso legítimo, específico e controlado no Painel Central conforme as permissões aprovadas. O acesso de um treinador ao seu programa não autoriza o treinador a conceder este consentimento por você.
>
> **Sua escolha:** Você pode negar agora e continuar utilizando as funções de treinamento disponíveis que não dependam dessa revisão E5. O não consentimento impede novas análises personalizadas que dependam da autorização, sem limitar automaticamente sua classificação esportiva ou os treinos já publicados.
>
> **Revogação:** Você poderá retirar a autorização. A revogação deve interromper novas utilizações dependentes do consentimento E5; ela não altera retroativamente os treinos publicados. Os registros históricos e as evidências de decisão poderão ser mantidos ou eliminados conforme a política de retenção e as obrigações aplicáveis, ainda sujeitas a aprovação.
>
> **Limites:** A autorização não é diagnóstico, promessa de hipertrofia, garantia de resultados, permissão para progressão automática, alteração de cargas/volumes nem publicação automática de programas.
>
> **Representação:** O fluxo inicial é destinado exclusivamente ao atleta apto a consentir diretamente. O consentimento em nome de menores ou representantes depende de política específica ainda não habilitada.

**Texto estritamente propositivo.** Não atribuir versão produtiva, data de vigência ou prazo de retenção antes das decisões da Camada Mestre e da revisão de privacidade.

## 6. Retenção e revogação — proposta pendente

Separar registros operacionais de treino, declarações de recuperação, trilha de consentimento e trilha de acesso. Propor, para cada categoria: finalidade, base autorizadora, responsáveis, retenção mínima/máxima, acesso, anonimização/eliminação, restrições legais e tratamento de revogação. **Não fixar prazo arbitrário.** A revogação impede novas operações dependentes de E5, enquanto o histórico anterior deve ficar sob controle de acesso, minimização e decisões de retenção explicitamente aprovadas. Um documento aprovado deverá explicar o canal operacional de revogação antes de liberar a interface.

## 7. Testes e limites

Os testes usam fixture **estrutural** com funções de autorização M0 reproduzidas e delegação `health_athlete_access`; não são execução integral sequencial de todas as migrations oficiais ou prova do RLS produtivo. Exercitam concessão, negativa, revogação, versões, atleta sem `auth_user_id`, treinador delegado, horários do servidor, ausência de JWT, sessão elegível, rejeições de duplicidade e cadeia de retificações. O job isolado M3/F22 valida regressão sintética; o fluxo integral F21 não foi homologado.

A prova consultiva de leitura da última retificação exige validação específica no PostgreSQL descartável, separada do simples fato de conseguir **gravar** correções. Sem autorização E5 vigente, a revisão não pode ser consumida. Nenhum dado sintético demonstra eficácia ou dose ótima.

## 8. Critério para próxima deliberação

Camada Mestre deverá deliberar sobre: (i) redação integral e política de privacidade, (ii) retenção e critérios de eliminação, (iii) autoridade para aprovar/ativar políticas e sua prova documental, (iv) papéis de menores e representantes, (v) efeito persistente e migração integral em banco descartável antes de cogitar produção. **NÃO MERGEAR PR #999; NÃO DEPLOYAR; NÃO COLETAR DADOS REAIS; F23 NÃO ABERTA.**
