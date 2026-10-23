# Registro prático — Chat Especialista + GitHub + Lovable + Codex mínimo
**Painel Central | 23/10/2026 | V1.0 | Natureza: experiência operacional complementar**

> Este registro descreve um método de trabalho comprovado, para repasse a novos especialistas. **Não substitui** a Diretriz Complementar de Execução Flexível V1.0 (19/09/2026), nem a governança GitHub/Lovable/Supabase/Codex V1.0.

## Método que funcionou

O **Chat Especialista**, quando possui conectores autenticados e permissões apropriadas, pode executar diretamente a maior parte da evolução funcional:

1. **Entender o estado real:** ler código da `main` no GitHub e evidências operacionais no Lovable Cloud; delimitar uma evolução útil.
2. **Implementar no GitHub:** criar branch, modificar código, escrever testes, conferir diff, abrir PR, verificar CI, fazer merge autorizado e confirmar o SHA da `main`.
3. **Conferir no Lovable Cloud:** verificar dados, vínculos e efeitos reais no backend canônico. Alterar registros de produção **somente com autorização, escopo limitado e validação antes/depois**.
4. **Usar Codex apenas quando agrega capacidade:** executar comandos pontuais em Cloud Shell, ambiente local ou infraestrutura/segredos inacessíveis ao chat. Enviar tarefa pequena, SHA exato, proibições claras e exigir JSON sanitizado. Codex não precisa repetir o desenvolvimento nem a investigação que o especialista consegue realizar.
5. **Comprovar a operação:** distinguir código mesclado, registro persistido, preview validado e ação operacional realmente concluída. Prosseguir com ciclos curtos: **CONSTRUIR → USAR → OBSERVAR → CORRIGIR → EVOLUIR**.

## Exemplo comprovado — Shopee Adão (23/10/2026)

- O especialista implementou melhorias e testes diretamente no **GitHub**, conferiu PRs/CI/merges e verificou diretamente no **Lovable Cloud** OAuth, snapshots, mappings e pedidos.
- O **Codex** limitou-se aos comandos necessários no **Google Cloud Shell** para renovação de token, leitura/captura de pedidos e execução da prévia, com segredos protegidos e saídas sanitizadas.
- A prévia oficial retornou **3 pedidos `ready`, 0 `blocked`, 0 `written`**. O mapping de trufa foi ligado à composição física validada de **6 sabores × 5 por kit**; **nenhum pedido foi criado nessa prévia**.

## Limites que não mudam

- **GitHub/`main`** é a verdade canônica de código; **Lovable Cloud/Supabase oficial** é o backend canônico.
- Preservar rastreabilidade, isolamento por conta, permissões, secrets protegidos e revisão proporcional ao risco.
- Não repetir operações incertas nem confundir **merge com deploy**, **prévia com escrita** ou **pedido com ordem de produção**.
- **Criar pedido não baixa estoque**; baixa depende de fato físico.
- Questões estruturais ou transversais seguem a governança existente. Codex continua indicado para refatorações amplas, depuração complexa e execução que de fato exigir seu ambiente.

## Instrução pronta para um novo especialista

> **Adote o método GitHub direto + Lovable Cloud direto + Codex mínimo.** Investigue, implemente mudanças delimitadas, teste, version e confira o runtime diretamente sempre que seus conectores permitirem. Delegue ao Codex somente comandos ou tarefas cuja execução realmente o exija. Preserve a `main`, o backend canônico e a segurança. Diferencie claramente o que foi preparado, mesclado, persistido e comprovado em uso real.

**Síntese:** *O especialista opera; o Codex complementa; o GitHub registra; o Lovable comprova; o uso real orienta a próxima evolução.*
