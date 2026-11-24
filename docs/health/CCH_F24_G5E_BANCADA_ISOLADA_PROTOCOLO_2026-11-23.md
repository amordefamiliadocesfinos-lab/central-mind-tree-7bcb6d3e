# CCH F24 G5-E — Bancada de ensaio isolada no GitHub
**Data:** 23/11/2026 · **Estado:** engenharia de homologação em PR DRAFT; **G5 geral permanece PARCIAL**.

## 1. Necessidade e autoridade
A contraprova autenticada G5 documentada na Issue #966, comentário #7116268356, confirmou que o commit `d24ae9546f6a9a6d91144015e989e3549a49de69` estava servido, mas o treino em fila não possuía sessão ativa retomável. Para alcançar a F19 no ambiente oficial seria necessário iniciar uma sessão real, fora da autorização de somente leitura. O teste sintético anterior G1/G2 já verificava 3→4→5 e duas transações SQL concorrentes em PostgreSQL temporário. **Esta entrega estende a capacidade de visualizar a sessão ativa e guardar screenshots de viewport sem acessar produção.**

## 2. Artefato isolado
- `scripts/health-cch-f24-g5e/index.html`: página somente para a bancada local, nunca vinculada às rotas produtivas.
- `main.tsx`: renderiza o **componente React F19 verdadeiro do módulo Saúde**, com ator fictício e sessão M4 simulada; estado inicial 3 séries completas em descanso, duas opções para seguir; controlador F19 sintético em memória/localStorage para avançar série 4 e 5, salvar resultado, pausar, recarregar e observar outra aba.
- `vite.config.ts`: root apenas `scripts/health-cch-f24-g5e`, servido por padrão somente em 127.0.0.1:4177.
- `g5e.browser.spec.mjs`: testes reais com Chromium + Playwright sobre F19, incluindo 3/3→4/3→5/3 com cliques explícitos e navegação anterior/próxima, remount por recarga, segundo contexto de aba, larguras 320/360/390/430/1280px; captura de screenshots.
- `playwright.config.mjs`: executa servidor local efêmero, sem deployment.
- `.github/workflows/health-cch-f24-g5e-isolated.yml`: CI em PR, `npm ci`, TypeScript/build sem dependência efêmera, instalação temporária de runner Chromium e artefatos de 7 dias. Gatilho restrito a alterações da bancada.

**Barreira:** o navegador rejeita requisições HTTP fora de localhost; o fixture usa IDs fixos evidentemente artificiais e não importa clientes de Supabase, chaves, autenticação, projetos, APIs ou dados reais; nenhum deploy ou DB oficial. O workflow possui apenas permissão GitHub `contents: read` e não recebe secrets.

## 3. Hierarquia de evidência — sem falsas equivalências
| Prova | O que permite concluir | O que NÃO permite concluir |
|---|---|---|
| GitHub CI TypeScript/build | Integração sintática do código atual | Publicação/autenticação real |
| Playwright Chromium local | UI F19 real funciona diante do controlador sintético, viewport e escolhas explícitas | Sessão real no Painel Central; Supabase Auth/RLS |
| LocalStorage + evento `storage` | Reabertura local e outra aba podem observar alterações da simulação | Isolamento transacional ou idempotência entre abas reais |
| CI PostgreSQL F19 de #1027 | RPC original suporta série extra, idempotência e bloqueio de corrida em esquema temporário | Segurança/RLS ou dados no Lovable Cloud oficial |
| G5-A Work autenticada | Publicação de commit E2/G1/G2 | Jornada F19 ativa (que exigia novo treino) |

O cabeçalho da bancada informa **SEM AUTENTICAÇÃO REAL**. Nunca descrevê-la como um ambiente autenticado do projeto. Para G5 autenticada **final**, é necessária uma sessão de treino isolada com um usuário de testes próprio em uma infraestrutura segregada **com autorização específica**, para não atingir atletas reais nem produção. Este PR não provisiona usuário de teste, instância Supabase, Lovable Cloud ou infraestrutura remota.

## 4. Critérios e checkpoints
1. Confirmar no GitHub a branch separada e a PR draft sem alterações `src/`, `supabase/migrations`, `supabase/config`, M3, auth ou mapas FROZEN.
2. Exigir CI específica `completed/success`; verificar as capturas e a ausência de acessos externos. CI falha = não aprovado, com correção na mesma branch.
3. Evidências G5-E locais podem fechar a **subetapa isolada** se aprovadas; a Issue #966 e a **G5 global permanecem PARCIAIS** até ensaio real autenticado segregado e autorização de G5/rollout, sem criar registros em Deividi/Rafaela.
4. Não combinar este PR com G3 mídia, G4 IA, E5, F23. Não dar merge/ativar no app com base apenas em CI.

## 5. Execução local opcional por pessoa técnica
```bash
npm ci
npm install --no-save --no-package-lock --ignore-scripts @playwright/test@1.56.1
npx playwright install chromium
npx playwright test --config scripts/health-cch-f24-g5e/playwright.config.mjs
```
O ambiente local é um **simulador de UI**, não precisa de login do usuário e não deve receber variáveis do projeto produtivo.
