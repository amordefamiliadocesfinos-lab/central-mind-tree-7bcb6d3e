# CCH F24 — G5-F | Contrato de ambiente autenticado segregado · 23/11/2026

**Natureza:** preparação consultiva e preflight estático, sem provisionamento. **G5 geral = PARCIAL**. Autoridade: Mapa Soberano v5.4 FROZEN e Evolução Motor V1.0 FROZEN; decisão G5 PARCIAL e evidências sintéticas na Issue #966; G1/G2 `main@d24ae9546f6a9a6d91144015e989e3549a49de69`; bancada de navegador G5-E PR #1033 (draft), 7/7 Playwright aprovados em isolamento local.

## 1. Lacuna exata
A sessão oficial publicou G1/G2, porém o treino exibido estava em fila: o Work não pôde entrar no F19 sem criar sessão real. A PR #1033 prova a UI em Chromium com controlador fictício, **sem Supabase Auth/RLS real**. A CI PostgreSQL de #1027 provou RPCs F19 contra esquema descartável, não autenticação do Lovable Cloud. G5-F deve reunir **UI real + autenticação real + DB isolado**, sem usar atletas/infraestrutura produtivos para writes.

## 2. Decisão de infraestrutura necessária antes de executar
**Preferência:** um projeto/tenant de homologação novo e comprovadamente segregado do Lovable Cloud oficial, com banco/Auth próprios, URL própria, dados exclusivamente sintéticos e acesso limitado. **Alternativa somente com decisão explícita:** stack Supabase descartável/local com Auth real e interface do código correspondente, deixando claro que não prova deploy do Lovable Cloud. Nunca usar o mesmo projeto Lovable Cloud `1720a410-34cd-4410-995c-8c92c7edf16b`, a mesma instância de banco, o mesmo pool de usuários, Storage, secrets ou chaves de produção, mesmo criando um usuário marcado como teste.

### Portão de autoridade G5F-A — SEM APROVAÇÃO REGISTRADA
A Camada Mestre precisa decidir e registrar na Issue #966:
- ambiente escolhido, URL e UUID do **projeto de ensaio** (não o oficial); responsável por ciclo de vida e limpeza;
- capacidade de Auth real, banco distinto e RLS compatível; prova documental de isolamento de instância (não apenas subdomínio);
- autorização limitada para **criar/excluir apenas** contas fictícias, programa draft/sessão/sets/timers sintéticos dentro da instância de ensaio;
- orçamento/recursos, janela de execução, expiração e mecanismo de destruição/rollback;
- autorização de publicar **somente o ambiente de ensaio** caso haja dependência de deployment. Publicar o projeto oficial continua proibido.

Sem esse despacho o trabalho **para no preflight**, sem criar nada externamente.

## 3. Preflight estático disponível
`scripts/health-cch-f24-g5f-preflight.mjs` rejeita host ou UUID oficiais, URLs inválidas/com credenciais ou sem autorização explícita. `scripts/health-cch-f24-g5f-preflight.test.mjs` cobre negativa/positiva. **`ok=true` significa SOMENTE configuração com formato aceitável**; jamais declara que o tenant é isolado, que o Auth é real ou que RLS está correto. A verificação de isolamento precisa ser feita no backend homologado por fontes administrativas e testes reais.

## 4. Plano de teste autenticado F19 (executar somente após G5F-A)
1. Identificar deployment, commit/asset/fingerprint do **ensaio** e registrar diferença da produção; abrir uma sessão genuína com **atleta sintético A** e outra identidade B sem acesso.
2. Confirmar claims de autenticação pelo backend, não por `user_metadata`; autenticação e autorização não são equivalentes.
3. Comparar RLS: A pode ler/escrever **seus** dados; B não lê/edita A, acesso anônimo negado; nenhum acesso ao oficial. Validar token sem uso de service-role no navegador; RPCs `SECURITY DEFINER` protegidos por `auth.uid()` e `health_can_write_athlete`.
4. Com programa sintético de 3 séries, testar sessão F19 `3/3 → 4/3 → 5/3`, com escolha explícita por série extra a cada passo, mudança de exercício/retorno, atualização de carga/reps/RIR no ensaio e manutenção de M3; recarga durante descanso; não criar sexta automaticamente.
5. Dois clientes autenticados da mesma identidade executam em paralelo o mesmo evento e eventos distintos; verificar idempotência por `client_event_id` e **um único intervalo ativo** no banco, antes e após refresh.
6. Em telas 320/360/390/430/1280, validar hierarquia e toque dos botões, foco, teclado, rolagem, pausa/retorno, alerta de descanso e histórico contextual por **rótulo confirmado** (sem inferir identidade física).
7. Evidenciar logs, snapshots, screenshots e registros de autorização; executar limpeza controlada do tenant de ensaio e provar que o banco produtivo **não foi consultado nem modificado**. Não incluir segredos, JWTs ou informações pessoais nos artefatos.

## 5. Matriz de aceite
| Critério | Prova exigida | Situação atual |
|---|---|---|
| G5F-AC01 | Despacho de infra/identidade/limpeza | **PENDENTE** |
| G5F-AC02 | Tenant/DB/Auth realmente segregados | NÃO PROVADO |
| G5F-AC03 | Login real A e B, claims corretas | NÃO EXECUTADO |
| G5F-AC04 | RLS A→B, anon e RPCs restritos | NÃO EXECUTADO |
| G5F-AC05 | F19 ativo 3→4→5 e reload, sem autoprogressão | PROVA LOCAL SINTÉTICA APENAS |
| G5F-AC06 | Corrida RPC contra DB de ensaio com dois clientes Auth | PROVA POSTGRES DESCARTÁVEL APENAS |
| G5F-AC07 | UX móvel e acessibilidade com sessão real | PROVA LOCAL SINTÉTICA APENAS |
| G5F-AC08 | Readback/limpeza/zero writes oficiais | PENDENTE |

**Critério de fecho:** todos AC01–AC08 comprovados por evidências do ambiente segregado. Caso contrário, **G5 = PARCIAL**. Não declarar falha de F19 só por ausência de infraestrutura de homologação.

## 6. Isolamento e continuidade
- Sem construtor/agente visual Lovable, apenas GitHub para código.
- Sem alteração de `main`, migrations, RLS, buckets, usuários reais, sessões reais, M3/F22 publicados, mapas FROZEN.
- Sem abrir F23 ou E5, sem integrar P3/P5/P6 por inferência.
- PR #1031 preservada apenas como evidência e PR #1033 draft como bancada sintética.
- Esta PR é **consultiva, em DRAFT**, e não constitui autorização para provisionar infraestrutura.
