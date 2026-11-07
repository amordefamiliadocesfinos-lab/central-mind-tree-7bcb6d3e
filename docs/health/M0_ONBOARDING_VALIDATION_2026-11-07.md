# M0B — Validação do onboarding e guard Health

Data: 07/11/2026

## Fluxo implementado

`/saude/*` agora é protegido por `HealthAccessGuard`.

Comportamento:
1. sessão autenticada existente;
2. consulta por `health_athletes.auth_user_id = auth.users.id`;
3. se existir atleta ativo, libera o módulo;
4. se não existir, apresenta onboarding;
5. onboarding cria somente o próprio perfil Health;
6. após criação, o estado local recebe o atleta e o módulo é liberado.

## Componentes

- `src/modules/health/hooks/useHealthAthlete.ts`
- `src/modules/health/ui/HealthAccessGuard.tsx`
- `src/modules/health/ui/HealthOnboarding.tsx`
- `src/modules/health/HealthModule.tsx`

## Segurança

- autorização não depende de `app_users.role`;
- identidade usada para ownership: `auth.users.id`;
- `app_users` pode ser usado apenas como conveniência de nome inicial;
- `user_metadata` é usado somente como fallback visual de nome e nunca para autorização;
- RLS continua sendo a autoridade final;
- outro usuário não consegue consultar o atleta criado no teste.

## Teste transacional executado

Cenário:
- usuário A cria atleta próprio;
- consulta do usuário A encontra o perfil;
- segunda criação para o mesmo `auth_user_id` é impedida pela constraint única;
- contexto muda para usuário B;
- usuário B recebe 0 registros para o atleta A;
- transação é revertida.

Persistência após o teste:
- `health_athletes = 0`
- `health_athlete_access = 0`

Nenhum dado pessoal real foi criado.

## Mobile-first

O onboarding usa:
- `min-h-[100dvh]`;
- largura máxima `max-w-md`;
- padding móvel `px-3`;
- botão principal `min-h-11`;
- teclado/nome com `enterKeyHint=done`;
- sem dependência de hover;
- card único e fluxo de uma tela.

## Gates restantes antes do item global Saúde

- build;
- lint;
- inspeção visual mobile real em 320–430 px.

Somente depois desses gates o item Saúde deve ser inserido no `GlobalFooterBar`.
