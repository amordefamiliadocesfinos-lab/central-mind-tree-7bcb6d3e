# CCH E2 — contraprova isolada de permissões e invariantes

Referências: mapa CCH V1.0 FROZEN, M3, F21, F22, PR #968.

**Banco:** PostgreSQL 17 temporário no GitHub Actions, dados totalmente sintéticos. O workflow executa a migração E2B real, sem acessar o banco de produção, sem apt-get e sem depender de instalar um cliente PostgreSQL no runner. RLS e roles `authenticated` / `anon` são habilitadas no fixture.

**Contratos automatizados:**
- função `SECURITY INVOKER`; usuário anônimo não pode executar;
- proprietário A troca duas posições, sem colisão no índice unique; registra justificativa;
- proprietário A substitui somente alternativa do catálogo com músculo principal coincidente e preserva a classificação `provisional`;
- acesso cruzado à prescrição do atleta B bloqueado;
- prescrição publicada não pode ser alterada;
- outra sessão, músculo incompatível, exercício inativo, ausência de equivalência, equivalência sem direção válida e justificativa curta rejeitados;
- registros sintéticos de sessão/filas e versão publicada preservados.

**Fora de escopo da contraprova:** não comprova a experiência autenticada de interface do usuário, gate completo de publicação F22, nem validação clínica de equivalências. O restante da E2 não deve ser declarado integralmente homologado sem essas verificações.

O teste no servidor é de contrato e integração SQL sintéticos, distinto de homologação real.
