# Resultado da investigação (somente leitura) — nucleo-knowledge-read

Nada foi alterado. Aprovar este card NÃO autoriza deploy; a ação mínima exige autorização separada e explícita.

## Evidências
1. **Implantação:** o último deploy observável nesta conversa foi o feito pelo próprio agente (AC-02), a partir da main `0c3721a7` (14/11/2026 15:19 -03), `source_sha256 8851906274321608845095b69b9dc4f83a28881d45426503cdde495a51a1ec06`; depois disso, sem JWT a função retornou 401. Não tenho ferramenta que leia a revisão/data atual direto do runtime, então não confirmo se houve outro deploy depois.
2. **Logs de 18/11 12:04 BRT (15:04 UTC):** a ferramenta de logs retorna "No logs found" para essa função. Não há evidência do 400 disponível para mim.
3. **Comparação com o código da main sincronizada (`843af60b`, 16/11):**
   - O código atual aceita `{module_code:'CRM', include_ac02:true, include_assumption_export:true}`: `CRM` passa em `/^[A-Z]{3}$/`, e a chave `include_assumption_export` está na lista permitida (index.ts:120-125).
   - Na versão implantada (`0c3721a7`), `include_assumption_export` não existe. O validador rejeita chaves desconhecidas com 400 "Informe module_code válido e opções booleanas…".
   - Há 8 commits na função e no `_shared/nucleo` depois de `0c3721a7` (de `e0176191` a `843af60b`).
4. **Causa provável (não confirmada por log):** o runtime está desatualizado em relação à main, e o 400 vem da chave `include_assumption_export`, que a versão implantada não reconhece. Outras causas possíveis de 400: JSON ou corpo inválido, ou módulo `NUC`.

## Lacunas
- Revisão e data reais do runtime não são observáveis com as ferramentas atuais.
- Não há logs da chamada das 12:04.

## Ação mínima sugerida
- Reimplantar só `nucleo-knowledge-read` pelo mecanismo nativo de deploy do Cloud (`supabase--deploy_edge_functions` com `["nucleo-knowledge-read"]`), a partir dos arquivos já sincronizados da main, sem editar nada.
- Exige autorização expressa do proprietário, limitada a essa função. Antes do deploy, comparar os arquivos da função e do `_shared/nucleo` com a main.
- Depois: sem JWT deve dar 401. O teste do contrato precisa de uma sessão autorizada com `nucleo_manage`.
