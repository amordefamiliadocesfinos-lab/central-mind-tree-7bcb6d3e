# F19 — UI / UX SPEC V1

## 1. Regra de interação

A ação principal durante o treino deve exigir **um toque**.

Digitação passa a ser opcional.

## 2. Barra fixa do treino

Mostrar:
- nome da sessão;
- cronômetro ativo;
- estado ativo/pausado;
- botão Pausar/Retomar.

Quando pausado:
- relógio principal congela;
- banner "Treino pausado".

## 3. Card atual

Somente um exercício deve receber destaque como "Agora".

Mostrar:
- nome;
- série atual / séries planejadas;
- faixa de reps;
- RIR alvo;
- descanso alvo.

### Estado pronto
Botão grande:
**Iniciar série**

### Estado executando
Relógio grande:
**Execução 00:32**

Botão grande:
**Concluir série**

### Estado descansando
Relógio grande:
**Descanso 01:47**

Mostrar:
- meta: 02:00;
- restante até meta enquanto abaixo;
- extra após meta.

Ao cruzar meta:
**Descanso atingido — pode voltar**

Botão:
**Voltar ao exercício**

Esse botão encerra o descanso e inicia a próxima série quando aplicável.

## 4. Final de exercício

Quando atingir o número planejado de séries:
- não iniciar nova série automaticamente;
- mostrar **Próximo exercício**;
- o toque encerra descanso atual, se houver, e inicia a primeira série do próximo exercício.

## 5. Dados detalhados

Área recolhível:
**Detalhes da série**

Campos existentes:
- carga;
- unidade;
- reps;
- RIR.

Não impedir o fluxo rápido quando vazios.

## 6. Aviso de descanso

V1:
- visual;
- vibração;
- beep curto quando permitido.

Não solicitar permissão de notificação do sistema na v1.

## 7. Persistência

Fechar/reabrir a página não zera:
- treino;
- pausa;
- execução;
- descanso.

## 8. Acessibilidade

- botões grandes >= 44px;
- estados não dependem apenas de cor;
- `aria-live` para aviso de descanso;
- labels textuais claros;
- cronômetros com fonte monoespaçada.
