# Núcleo 2.0 M4 — compactação visual e pré-conferência segura de fontes

**Data:** 11/11/2026  
**Mapa:** Núcleo 2.0 V1.0 — M4, sem criação de módulo paralelo.

## Visualização
A ficha da M3 mostra as evidências técnicas agrupadas por tipo e em ordem de conferência. Os grupos e as informações detalhadas abrem apenas sob demanda, reduzindo repetição de notas de proveniência. O botão **Recarregar** atualiza somente os registros do Core; não busca GitHub em tempo real.

## Pré-conferência das fontes
- `scripts/nucleo-m4-github-refresh.cjs` consulta as PRs #608, #611, #614, #619 e execuções CI #43094643388, #43103257248, #43108556183, verificando identificação, URL e estado na fonte oficial.
- O workflow `nucleo-m4-github-refresh.yml` executa manualmente e em agendamento diário (11:17 UTC); usa apenas token padrão do GitHub Actions com permissões `contents:read`, `pull-requests:read` e `actions:read`. A execução nunca acessa o Supabase.
- A saída é um **manifesto JSON como artefato temporário por sete dias**, marcado `read_only` e `requires_human_review`. O manifesto relata divergências, mas não aplica alterações em `nucleo_development_evidence`, nos estados da M3 ou nas permissões administrativas.
- `scripts/nucleo-m4-github-refresh.test.cjs` testa sucesso, divergência, identidade trocada e erro de permissão, usando respostas sintéticas.
- A lista de IDs é explícita; PRs de outras frentes não são atribuídas automaticamente. Migrations Supabase permanecem dependentes de conferência independente.

## Portão de reconciliação futura
Um novo registro `verificado` exige conferir GitHub e o histórico real do Supabase, confrontar o ID com a frente correta e preservar snapshot anterior em nova linha append-only. Um estado `divergente` não pode ser usado para concluir a frente, e a divergência não autoriza rollback automático. Qualquer ação de banco deve usar executor técnico autorizado, com transação, guardas e leitura posterior; **o workflow agendado não possui segredo de banco nem permissões para gravar**.

## Patrimônio
Sem modificações de migrations, RLS, grants, `localStorage`, 82 páginas, conteúdo do Drive, M1/M2 ou estados M3. A homologação visual dos grupos expansíveis fica separada do build.
