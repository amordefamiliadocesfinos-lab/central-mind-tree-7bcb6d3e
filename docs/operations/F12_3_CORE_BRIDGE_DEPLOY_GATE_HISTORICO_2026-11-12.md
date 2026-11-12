# F12.3 — GATE DE PUBLICAÇÃO EXCLUSIVA DO CORE BRIDGE

**Projeto:** Painel Central — Amor de Família  
**Data da investigação:** 12/11/2026  
**Frente:** F12.3, mapa congelado, desenvolvimento ativo  
**Fonte canônica:** `amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e`, branch `main`  
**Projeto Lovable conectado (somente conexão técnica):** `1720a410-34cd-4410-995c-8c92c7edf16b`  
**Supabase/Core oficial:** `xkskyutmtlhivvpfxkjg`  
**Função exclusiva:** `integration-core-bridge`

## 1. Histórico do método — evidências, não suposições

- Commit `04eef94f510a5973e7bfd3ecc9ad4f47354a18de` (09/10): publicação isolada da Edge Function existente a partir do código GitHub, sem frontend, migrations, secrets, Shopee Live ou novas operações.
- Commit `adc0e3da35c88b80cec5a5e72d288826aab05ab9` (22/10): mecanismo isolado, comparar código e dependências antes do deploy, registrar SHA256/bundle publicado e ler baseline após a publicação.
- Commit `80efc249e3551936f938e93e64b9d98ea3576c52` (26/10): uso do mecanismo autenticado interno que já havia sido empregado na PR #204; capturar versão anterior e posterior, sem edições, sem retry diante de incerteza.
- PR #550 (09/11): agente de publicação introduziu **edição indevida no módulo Saúde**, posteriormente revertida. Exige-se segregação estrita: *publicar não é editar*.

**Não confundir o antigo método de publicação exclusiva pelo serviço conectado com o construtor visual Lovable.** Não usar o construtor, não criar commits pelo agente de publicação.

## 2. Identidade do bundle de origem verificada

Comparação de conteúdo **GitHub main vs leitura do projeto conectado**, realizada em 12/11:

| Arquivo de função | Resultado |
|---|---|
| `supabase/functions/integration-core-bridge/index.ts` | Igual após normalizar apenas quebra de linha final |
| `supabase/functions/integration-core-bridge/handler.mjs` | Igual após normalizar apenas quebra de linha final |
| `supabase/functions/integration-core-bridge/cycle.mjs` | Igual após normalizar apenas quebra de linha final |
| `supabase/functions/integration-core-bridge/logistics-read-state.mjs` | Igual após normalizar apenas quebra de linha final |
| `supabase/functions/integration-core-bridge/mapping-physical-catalog.mjs` | Igual após normalizar apenas quebra de linha final |
| `supabase/functions/integration-core-bridge/shopee-intake-mapping-catalog.mjs` | Igual após normalizar apenas quebra de linha final |
| `supabase/functions/integration-core-bridge/adao-intake-freshness.mjs` | Igual após normalizar apenas quebra de linha final |

**Atenção:** equivalência de texto de arquivos acessíveis **não é evidência de bundle publicado**. O byte de diferença observado em cada arquivo correspondeu à quebra de linha final; para evidência de publicação, exigir SHA256 exato dos **bytes de fato enviados**. Reconfirmar antes de publicar, pois `main` pode avançar.

`supabase/config.toml` contém `[functions.integration-core-bridge] verify_jwt = false`. Isso exige preservar obrigatoriamente a autenticação privada HMAC-SHA256 v1 existente; `verify_jwt=false` não autoriza acesso público às ações de negócio.

## 3. Estado atual verificado

- Migrations F12.3 `20261112180000`, `20261112220000`, `20261112233000` **registradas no Core**.
- Leitura do Core confirma 0 registros na tabela `shopee_adao_f12_discovery_state` no momento do levantamento.
- Cliente Hub, handler e RPCs `acquire`, `stage`, `ack`, `resume` estão no GitHub.
- Acesso de gestão da Edge Function pelo conector Supabase retornou **permission denied**. Não há metadata de revisão publicada nem aprovação para assumir que o runtime suporta as novas ações.
- Portanto **não realizar teste live mutante, não afirmar deploy e não ativar a rota F12.3**.

## 4. Comando operacional para o publicador autorizado

**Operação única:** publicar/atualizar **somente** a Edge Function `integration-core-bridge` no projeto Supabase `xkskyutmtlhivvpfxkjg`, usando os bytes do bundle canônico no SHA GitHub **confirmado imediatamente antes da ação**, e o mesmo mecanismo autenticado isolado já comprovado em outubro.

1. Registrar revisão/versão e hora do serviço publicado antes de tocar no runtime.
2. Validar igualdade de código e dependências da função com o GitHub canônico. **Abortar caso diverjam**.
3. Verificar se o operador tem permissão explícita de publicação da função. **Abortar se não tiver**. Não contornar via SQL, construtor visual, frontend ou troca de backend.
4. Confirmar que o deploy preserva `verify_jwt=false`, todas as configurações e o secret `INTEGRATION_HUB_CORE_BRIDGE_HMAC_SECRET`; nunca exibir seu valor.
5. Publicar exclusivamente `integration-core-bridge`. **Não** editar código, commitar, executar migrations, publicar frontend ou outras funções.
6. Registrar ID/versão da função antes/depois, timestamp, SHA GitHub e SHA256 efetivo do bundle. Em caso de retorno incerto, **parar**; não tentar repetidas publicações sem confirmar o estado.
7. Testes sem efeito: health e rejeição HTTP 401 de requisição sem HMAC; verificar que funções e demais serviços foram preservados. Não acionar RPCs de `acquire/stage/ack/resume` sobre pedidos reais como teste de deploy.
8. Após confirmar publicação, validar um caminho HMAC não-mutante. Novo teste de concorrência PostgreSQL entre duas sessões e piloto controlado exigem recorte posterior separado.

## 5. Gate de integração ao executor real

A PR #665 entregou o executor F12.3 isolado sem rota, Scheduler ou writer de pedidos conectado. **Só após evidência real do item 4**:

- implementar ligação ao pipeline canônico de importação/persistência, sem duplicar writers;
- manter janela congelada, limite até 2 páginas por fatia e `3+3` logísticos;
- exigir reconciliação completa antes de avançar checkpoint;
- tratar estados incertos com bloqueio e diagnóstico, nunca retry de `ship_order` sem reconciliação;
- avaliar concorrência real, durabilidade, latência e escalabilidade 10→30→100;
- preservar Adão isolado de Viviane e do tráfego principal.

**Situação deste documento:** investigação e gate concluídos; **publicação da Edge Function não confirmada, não executada nesta frente**.
