# Núcleo 2.0 — Contraprova F1/F2 em PostgreSQL descartável

**Data:** 19/11/2026  
**Mapa soberano:** Núcleo 2.0 V1.3 — Entrega A+  
**Complemento:** Continuidade Canônica dos Especialistas V1.1, F1/F2/D1–D7  
**Estado:** ensaio técnico isolado; não é migration, RLS implantada, grant concedido, autorização de sucessão nem homologação F6/F7.

## Origem e necessidade

A [PR #1000](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/1000) demonstrou o modelo multiespecialidade em memória e a [PR #1002](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/1002) verificou uma matriz lógica de menor privilégio. Leitura `SELECT` do Core oficial constatou que cinco famílias de tabelas M3/M4/AC-01/FM e o endpoint AC-02 exigem hoje `nucleo_manage` ativo. Não existe prova de vínculo N:N real persistido nem acesso produtivo por especialidade.

## Laboratório controlado

A CI inicia **um serviço postgres:16 descartável** por job, com senha sintética exclusiva da CI. Executa somente `psql --file=scripts/nucleo-f1-f2-postgres-rls-lab.sql` no banco de teste local. O SQL cria schemas `lab` e `auth` **apenas nesse banco temporário**, roles locais `authenticated` e `anon` e dados sintéticos. **Proibido executá-lo contra o Core `xkskyutmtlhivvpfxkjg`.** Ele não está na árvore de migrations e não usa URL/credencial de produção.

Reproduz comportamentos relevantes de RLS com `SET ROLE authenticated` e `auth.uid()` simulada por configuração controlada do ensaio. Isso não reproduz validação real de JWT, auth.sessions, Data API/Edge, Grants Supabase ou toda a cadeia Auth; **não pode substituir UAT posterior em ambiente autorizado**.

### Cenários

1. F2: três instâncias/papéis sintéticos exercem funções diferentes no módulo `NUC`, sem módulos duplicados.
2. F2: uma especialidade estável atua em `NUC` e `CRM`, preservando um método geral e fontes de adaptações locais diferentes.
3. F1: somente associações do `auth.uid()` próprio, ativas, vigentes e não revogadas autorizam acesso à **projeção de metadados** correspondente ao mesmo módulo/especialidade.
4. F1: negativas de especialidade cruzada, módulo cruzado, vínculo expirado, vínculo revogado, ausência de identidade e revogação durante a própria sessão em leituras seguintes.
5. F1: proprietário sintético com `nucleo_manage` mantém leitura; outros atores não herdam a concessão.
6. F1: `anon` sem `SELECT`; `authenticated` não recebe `INSERT/UPDATE/DELETE` nem acesso bruto a tabelas de especialidades/instâncias.
7. Sem `SECURITY DEFINER`, service_role, writers, migrations, registros AC-01, FM-09/FM-10 ou mutações no Core.

### Limites

É um **protótipo de políticas e cardinalidade**, não esquema final aprovado. O modelo usa projeção `lab.context_read`, não as tabelas produtivas, para evitar que um novo leitor herde acesso desnecessário a evidências ou documentos privados. O controle `nucleo_manage` produtivo existente permanece protegido. A autorização real de identidade por módulo/especialidade depende de cadastro competente, RLS revisada, revogação e casos negativos adicionais, sem confiar em metadata editável.

**Próximo portão:** deliberação específica sobre o desenho persistente mínimo e revisão de segurança para eventual implementação. Não criar perfis, especialistas, grants ou vínculos reais sem autorização própria. Nenhuma prova sintética certifica assunção por sucessor distinto.
