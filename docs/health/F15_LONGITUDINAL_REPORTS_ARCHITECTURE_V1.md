# F15 — RELATÓRIOS LONGITUDINAIS — ARQUITETURA V1

## 1. Natureza

F15 é uma camada de apresentação e exportação.

Não cria facts.
Não cria estados.
Não cria decisões.
Não cria ações.

## 2. Rota

`/saude/relatorios`

## 3. Estrutura do relatório

### Identificação

- atleta;
- data de geração;
- data-base da revisão;
- janela atual;
- janela anterior.

### Resultado longitudinal

- status da revisão F13;
- domínios comparáveis;
- domínios indisponíveis;
- reason codes principais.

### Domínios

- treino;
- alimentação;
- evolução corporal;
- recuperação.

Cada domínio deve preservar:
- período atual;
- período anterior;
- delta quando existente;
- cobertura/confiança quando existente;
- estado de indisponibilidade quando não comparável.

### Revisão humana

- outcome F13;
- áreas alvo;
- notas.

### Replanejamento F14

Quando existir:
- status do caso;
- decisões por domínio;
- notas humanas.

### Limitações

Relatório deve declarar:
- não é diagnóstico;
- não substitui especialista/profissional;
- associação não é causalidade;
- ausência não é zero;
- nenhum ajuste foi aplicado automaticamente.

## 4. Exportação

### Impressão

Usar `window.print()`.

O usuário pode salvar como PDF pelo diálogo nativo do navegador.

### JSON

Gerar um snapshot no cliente contendo apenas dados já visíveis ao usuário.

Não incluir tokens, credenciais ou metadados de segurança.

## 5. Backend indisponível

Se F13 não estiver operacional no ambiente:

- exibir mensagem explícita;
- não fabricar relatório vazio como se fosse completo;
- permitir navegação para Revisão.

Se F14 não estiver disponível:
- relatório F13 continua válido;
- seção de replanejamento fica marcada como indisponível/não registrada.

## 6. Mobile/print

Mobile:
- uma coluna;
- cards;
- sem tabela horizontal obrigatória.

Print:
- esconder botões/navegação de ação;
- preservar títulos e seções;
- evitar cortes internos quando possível.

## 7. Autoridade

F15 é read-only.
Nenhuma RPC de escrita pertence à F15 v1.
Nenhuma migration é necessária na v1.
