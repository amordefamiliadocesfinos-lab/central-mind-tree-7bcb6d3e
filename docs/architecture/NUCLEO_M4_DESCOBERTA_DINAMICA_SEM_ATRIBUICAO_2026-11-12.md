# Núcleo 2.0 — M4 | Descoberta dinâmica sem atribuição automática

**Data:** 12/11/2026  
**Mapa soberano:** Núcleo 2.0 V1.0, frente M4  
**Restrição:** preservar os estados da M3, as 82 páginas locais e os documentos do Drive.

## Nova etapa de descoberta

`scripts/nucleo-m4-discover-github.cjs` consulta apenas GitHub API oficial para listar PRs e execuções recentes de CI. A consulta é paginada, limitada a **até três páginas de 100 itens por tipo**, e pode não conter todo o histórico do repositório. Cada item é validado por identidade numérica e URL canônica.

A saída `nucleo-m4-discovery-v1` declara explicitamente `read_only=true`, `automatic_core_write=false` e `requires_human_review=true`. São devolvidas duas classificações:
- `known_source`: o identificador já consta na lista de fontes oficiais explicitamente mapeadas; o código de frente é exibido como referência, não como nova aprovação.
- `unassigned_candidate`: fonte descoberta **sem frente atribuída**, mesmo que nome, branch ou descrição pareçam relacionados ao Núcleo.

**Todos os registros apresentam `proposed_workstream_code=null` e `requires_human_assignment=true`.** Nenhum texto de uma PR pode conceder escopo, papel administrativo, ou alterar o fluxo da M3.

## Separação obrigatória de decisões

1. **Descoberta:** captura metadados em artefato temporário do GitHub Actions, sem acesso ao banco.
2. **Atribuição:** exige decisão fundamentada por usuário/operador autorizado com confronto ao Mapa Mestre. Não aplicar correspondência de título, número de PR, nome de workflow ou branch por heurística.
3. **Reconciliação:** somente após a atribuição validada, comparar a identidade `source/kind/external_key` com `nucleo_development_evidence` e bloquear vínculos cruzados, divergências ou duplicidade.
4. **Gravação:** se e somente se houver evidência nova conferida e atribuição aprovada, executar transação técnica separada no Core e ler de volta. Nunca delegar INSERT ao workflow GitHub.

## Integração

O workflow `nucleo-m4-github-refresh.yml` continua manual, por agenda diária e por mudanças controladas na `main`; acrescenta testes e arquivo `nucleo-m4-discovery-unassigned.json` ao artefato M4 já existente. Permissões `contents:read`, `actions:read`, `pull-requests:read`. Não há token ou segredo Supabase em Actions.

O código anterior de conferência das fontes explícitas (`nucleo-m4-github-refresh.cjs`) e o reconciliador offline (`nucleo-m4-reconcile-review.cjs`) permanecem independentes da descoberta. O novo arquivo **não pode ser enviado diretamente ao reconciliador**, porque não contém atribuição de frente e tem esquema distinto.

## Portões de validação

- Testes sintéticos: lista com item conhecido e desconhecido, lista vazia, URL externa ou manipulada, HTTP 403, resposta malformada, paginação fora do limite e IDs incorretos.
- Build completo e CI isolado PostgreSQL 17.
- Primeira execução real do workflow e inspeção do arquivo gerado, incluindo contagens, limitação de cobertura e ausência de atribuição automática.
- Ainda não homologar novas fontes no Core enquanto suas frentes não forem atribuídas formalmente.

**Não houve migration, mudança de RLS, grants, alterações de documentos nem sincronização de estados.**
