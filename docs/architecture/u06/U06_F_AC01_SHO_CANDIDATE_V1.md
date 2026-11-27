# U06-F — A04.1 candidata de importação AC-01 SHO V1
Autorização: Issue #1037, comentários 7221695666 e 7221728368; proprietário determinou execução da frente.
## Escopo
Primeira contraprova limitada à proposta do refinamento multicontas V2.0, fonte GitHub imutável 095adee52910ecae78949595c4eeba65b60e2d46, módulo SHO, frente SHO-F12. Request fixo 87d4757e-9391-4fbd-a111-b3a8cf86aa06. A restrição fixa é intencional neste piloto, não arquitetura final transversal.
## Contrato
Canal administrativo já autorizado Lovable Cloud (identidade de workspace conferida pelo chamador antes de cada execução). O banco observa somente current_user/session_user postgres e ausência de auth.uid(); não consegue autenticar o usuário Lovable, atestar o agente individual ou verificar GitHub. Nenhuma simulação JWT, nova credencial, privilégio de aplicação ou SECURITY DEFINER. A função privada sem argumentos reutiliza o ledger AC-01 existente, com origem administrativo_lovable, referência da decisão e UID humano nulo. Registros humanos mantêm origem auth_app e UID não nulo, atribuído pelo trigger. Referência fixa e única por módulo no piloto, request único, lock transacional, replay com comparação exata. Sem update/delete nem promoção. O postgres continua administrativo; a função é contrato de uso, não proteção contra administrador deliberadamente malicioso.
## Gates
1. Executar CI histórica e contraprova candidata no PostgreSQL descartável. Não instalar SQL de docs/architecture/proposals diretamente em produção.
2. Conferir compatibilidade de leitores e telas com UID nulo e origem; publicar compatibilidade antes da alteração de schema. Inspecionar o schema efetivo e dependências antes da implantação.
3. Preparar migration oficial pela ferramenta suportada e revisão de segurança separada; não presumir autorização para aplicar candidata ou mudar permissões a partir do merge de engenharia.
4. Reconfirmar identidade Lovable, fonte GitHub imutável, decisão e ausência de contribuição antes da única chamada. Readback independente, replay apenas sob contrato idempotente e após reconciliação; se colisão, parar.
5. Provar exibição e recuperação em chat novo; somente então ampliar contrato de FM, M3 e M4, mantendo autoridade e versões.
## Não escopo
Não alterar Shopee Hub, pedidos, OAuth, Scheduler, flags, estoque, operações, mapas soberanos, F6/F7/B. Nenhum dado produtivo gravado nesta candidata. Não afirmar A04 produtivo nem A05/A06 antes de evidência.
