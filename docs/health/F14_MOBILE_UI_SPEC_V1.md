# F14 — MOBILE UI SPEC V1

## Rota

`/saude/replanejamento`

## Entrada

A tela deve priorizar mobile 320–430 px.

## Blocos

1. cabeçalho;
2. status do backend;
3. revisão F13 de origem;
4. caso atual;
5. itens por domínio;
6. ação explícita de decisão;
7. link para especialista;
8. conclusão do caso;
9. histórico.

## Decisão por item

Cada domínio deve ter opções simples:

- Manter atual
- Revisar
- Adiar
- Não se aplica

Campo de notas opcional.

## Regras UX

- nenhum botão deve sugerir “aplicar automaticamente”;
- CTA de revisão deve dizer “Abrir especialista”;
- CTA de fechamento deve dizer “Concluir revisão do caso”;
- mostrar aviso de que mudanças reais são feitas no módulo especialista;
- ausência de backend deve ser explícita;
- ausência de outcome F13 deve direcionar para `/saude/revisao`;
- alvos de toque min 44 px;
- sem tabela horizontal obrigatória em mobile.

## Navegação

Adicionar “Replanejamento” ao fluxo sem substituir “Revisão”.

Sequência conceitual:

Revisão → Replanejamento → Especialistas.
