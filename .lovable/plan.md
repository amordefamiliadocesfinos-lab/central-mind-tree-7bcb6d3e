
# Centro de Automação do CRM — Unificação Frontend

## Problema atual
Hoje o usuário vê dois blocos separados na página `/contatos`:
1. Painel amarelo **"Leads que precisam de contato"** (ações urgentes).
2. **Barra de filtros** (busca, tipo, status, classificação, tag, origem, temperatura, ação, contato p/ hoje, ordenação).

Eles não conversam: o usuário não sabe se deve filtrar primeiro, agir no painel, ou o que fazer depois. A experiência é fragmentada.

## Objetivo
Fundir os dois blocos em um único **Centro de Automação do CRM** — uma faixa sequencial no topo da página que guia o usuário do diagnóstico à ação, de forma clara e automática. Sem alterar nenhum dado, hook, tabela ou backend.

## Estrutura proposta (frontend apenas)

```text
┌─────────────────────────────────────────────────────────────────┐
│ 🤖 Centro de Automação do CRM                                   │
│─────────────────────────────────────────────────────────────────│
│ PASSO 1 — O QUE EXIGE ATENÇÃO HOJE                              │
│  [🔴 12 Urgentes] [🟡 8 Follow-up] [📅 5 Hoje] [❄ 3 Esfriando]  │
│  (chips clicáveis = aplicam filtro automaticamente)             │
│─────────────────────────────────────────────────────────────────│
│ PASSO 2 — REFINAR (opcional, recolhível)                        │
│  🔎 buscar…  Tipo ▾  Status ▾  Classif ▾  Tag ▾  Origem ▾       │
│  Temperatura: [Frio][Morno][Quente]   Ordenar ▾                 │
│─────────────────────────────────────────────────────────────────│
│ PASSO 3 — AGIR (aparece quando há resultado)                    │
│  N leads selecionados · [📱 Disparar WhatsApp em fila]          │
│                          [✅ Marcar contato feito] [Limpar]     │
└─────────────────────────────────────────────────────────────────┘
```

### Comportamento
- **Passo 1 (Diagnóstico automático):** chips inteligentes derivados dos mesmos dados que já alimentam `LeadsNeedContactPanel` + filtros existentes. Clicar num chip aplica o filtro correspondente e rola para a lista. Um chip ativo fica destacado; clicar de novo limpa.
- **Passo 2 (Refinar):** a barra atual, agrupada e recolhível ("Mostrar filtros avançados"). Fica fechada por padrão quando um chip do passo 1 está ativo.
- **Passo 3 (Agir):** o modo de seleção múltipla e o botão "Disparar fila" (hoje escondidos dentro do painel amarelo) sobem para uma barra de ação contextual que aparece só quando há leads visíveis + seleção. Reaproveita o `onBulkDispatch` e `handleWhatsApp` já existentes.
- **Nudge sequencial:** um pequeno texto guia ("1. Veja o que precisa de atenção → 2. Refine se quiser → 3. Aja em lote") aparece apenas quando nenhum passo foi tocado, e some no primeiro clique.

### Nada muda no backend
- Reuso integral de `useContacts`, `useNoResponseDetection`, `handleWhatsApp`, `openContactForm`, `bulkDispatchContacts`, `getUrgencyLevel`, `FUNNEL_STAGES`, etc.
- Sem migrations, sem edge functions, sem alteração em `contacts` ou `contact_history`.
- Todos os filtros existentes continuam funcionando; apenas ganham entrada guiada pelos chips.

## Arquivos afetados
- `src/pages/Contatos.tsx` — substituir o bloco atual (linhas ~994–1200) pelo novo componente `CrmAutomationHub`.
- `src/components/crm/CrmAutomationHub.tsx` — **novo**. Recebe por props o que já está no Contatos.tsx (contacts, filtros e setters, handlers). Renderiza os 3 passos.
- `src/components/crm/LeadsNeedContactPanel.tsx` — mantido como componente interno usado no passo 3 (modo lista compacta) ou aposentado se o novo hub cobrir tudo. Decisão: manter e reusar dentro do hub para não perder features de seleção múltipla.

## Detalhes técnicos
- Chips do passo 1 calculados via `useMemo` sobre `contacts` + `noResponseMap` (já disponíveis).
- Estado local do hub: `activeChip`, `filtersExpanded`. Filtros permanecem controlados pelo `Contatos.tsx` (levantados via props) para não quebrar `filteredContacts`.
- Sem novas dependências. Usa `Card`, `Button`, `Badge`, `Collapsible` (shadcn já instalado).
- Mobile: chips com scroll horizontal; filtros avançados recolhidos por padrão.

## Fora do escopo
- Não altera Kanban, drawer de contato, timeline, automações do funil, WhatsApp templates.
- Não altera Assistente/IA/edge functions.
- Não muda schema, RLS, ou qualquer hook de dados.

## Resultado esperado
Usuário abre `/contatos` → vê imediatamente **o que precisa fazer hoje** (chips) → clica → lista já filtrada → **age em lote** na mesma tela, tudo em 3 passos visuais.

---
Aguardando aprovação para implementar.
