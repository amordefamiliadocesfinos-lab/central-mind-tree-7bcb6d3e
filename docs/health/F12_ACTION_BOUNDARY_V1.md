# F12 — ACTION BOUNDARY v1

**Status:** DOCUMENTAL

---

## 1. Tipos de ação permitidos

F12 v1 possui somente:

### A. Navegação operacional

Links para:
- perfil;
- programa;
- treino;
- alimentação;
- evolução;
- recuperação;
- exames.

Não escreve dados.

### B. Avaliação integrada explícita

Chamada manual para:
`health_f11_evaluate_integrated_decision`.

Essa é a única mutação nova exposta pela F12 v1.

Ela não altera plano nem treino.

---

## 2. Ações proibidas

F12 não pode:
- criar/editar programa automaticamente;
- iniciar treino automaticamente;
- registrar alimentação automaticamente;
- criar medida corporal;
- criar check-in de recuperação;
- criar resultado clínico;
- alterar plano nutricional;
- alterar fila CCH;
- substituir exercício;
- escolher carga;
- criar recomendação médica;
- executar F11 silenciosamente.

---

## 3. Atualizar != Avaliar

Botão existente:
**Atualizar**

Contrato:
- SELECT-only;
- recarrega projeções;
- não grava ledger.

Novo botão possível:
**Avaliar integração**

Contrato:
- chamada explícita de RPC;
- loading próprio;
- feedback de sucesso/erro;
- depois faz reload;
- não deve ser confundido visualmente com Atualizar.

---

## 4. Avaliação com dados insuficientes

O usuário pode executar avaliação F11 mesmo quando a suficiência não está completa.

Resultado esperado pode ser:
- run paused;
- decision paused;
- reason codes.

F12 deve explicar:
“a avaliação foi executada, mas a decisão ficou pausada por falta de dados suficientes”.

Não usar:
“falhou”;
“resultado ruim”;
“risco”.

---

## 5. Next action

O próximo passo é uma ação operacional.

Estrutura conceitual:

~~~ts
type JourneyNextAction = {
  code:
    | "complete_profile"
    | "publish_program"
    | "execute_workout"
    | "record_nutrition"
    | "record_body"
    | "record_recovery"
    | "evaluate_integration"
    | "review_integrated_decision";
  href?: string;
  label: string;
  reason: string;
};
~~~

Nenhum next action altera automaticamente domínio especialista.

---

## 6. Reason-code routing

Quando F11 estiver paused, F12 pode mapear reason codes para uma rota operacional.

Exemplos:

- NUTRITION_DECISION_MISSING → alimentação;
- BODY_STATE_MISSING → evolução;
- BODY_RESPONSE_INSUFFICIENT → evolução;
- RECOVERY_STATE_MISSING → recuperação;
- RECOVERY_CONTEXT_INSUFFICIENT → recuperação.

Isso é navegação, não causalidade.

Se múltiplos motivos:
usar prioridade operacional documentada.

Não esconder os demais motivos.

---

## 7. Segurança

A avaliação integrada:
- exige atleta atual;
- usa RPC F11;
- autorização permanece no backend;
- frontend não recebe write grant nas tabelas F11;
- erro de autorização não deve ser reinterpretado como falta de dados.

---

## 8. Idempotência

A F12 não implementa idempotência própria.

Ela depende do fingerprint/idempotência F11.

Cliques repetidos com os mesmos inputs devem retornar o mesmo run conforme contrato F11.

UI deve desabilitar botão enquanto a chamada está em andamento para reduzir duplicidade acidental.

---

## 9. Auditoria

F12 não cria log paralelo.

A auditoria da avaliação pertence ao ledger F11.

Navegação não precisa de ledger clínico.

Analytics de produto, se existir, não pode virar fonte de verdade Health.
