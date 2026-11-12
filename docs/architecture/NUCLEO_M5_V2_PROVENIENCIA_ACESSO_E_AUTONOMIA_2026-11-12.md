# Núcleo 2.0 — M5 V2 | Proveniência, revalidação de acesso e autonomia restrita

**Data:** 12/11/2026. **Fonte soberana:** Mapa Mestre Núcleo 2.0 V1.0.  
**Escopo:** evolução aditiva da supervisão assistida existente; M5 permanece `em_validacao`.

## Alterações técnicas
1. **Rastreabilidade:** cada alerta que já possui IDs de evidência oferece fonte, tipo, chave externa, data de registro e da última conferência. Somente URLs canônicas do repositório oficial GitHub para PRs e CI são clicáveis; URLs divergentes, de origem incerta, com parâmetros ou de outra categoria não são abertas. Alertas sem prova técnica (próxima ação, bloqueio ou ausência de evidência) apontam para a ficha da frente e **não inventam** origem.
2. **Identidade e capacidade:** antes de produzir um diagnóstico, consultar `auth.getUser()`, verificar uma concessão ativa e não revogada de `nucleo_manage` da mesma identidade (sempre sob RLS), e ler novamente as frentes M3, dependências M3 e provas M4. A nova análise utiliza os dados desse ciclo, não cópias anteriores passadas pelo componente pai.
3. **Revalidação:** `Reavaliar` solicita um novo ciclo; mudanças de autenticação e retorno da aba ao estado visível invalidam o resultado anterior e exigem nova leitura. Erro, concessão ausente, sessão inválida ou limite atingido suspendem os alertas, sem transformar erro de permissão em falta de evidência.
4. **Autonomia:** não existe motor de escrita nem atualização automática da frente. Mensagens continuam sendo recomendações informativas; não há IA generativa, envio de dados externos ou concessão de permissões.

## Critérios e limites
- Testes isolados abrangem URL canônica, bloqueio de origem externa, seleção apenas de IDs mencionados, preservação dos registros e verificação dos guardas de sessão.
- Build completo valida a integração React.
- A homologação positiva real das recomendações com um usuário autorizado **não comprova sozinha** a revogação durante uma sessão aberta. Para isso é necessário ambiente controlado ou autorização específica que permita revogar e restaurar uma concessão sem risco de lockout administrativo. **Nenhuma concessão será revogada nesta implementação**.
- Revalidação acontece sob interação (Reavaliar), troca de identidade e retorno de aba; não equivale a monitoramento em tempo real sem foco.
- Uma fonte marcada `verificado` é um snapshot histórico, não verificação ao vivo do GitHub; o painel exibe `checked_at` para explicitar essa diferença.
- O limite de 500 frentes, dependências ou evidências é um portão de falha segura, não paginação exaustiva.
- O laboratório sintético DEMO-M5 continua isolado e identificado; nenhum alerta fictício contamina o relatório real.

## Preservação
Sem migrations, novas políticas RLS, grants, escrita em `nucleo_development_*`, importação de páginas, alteração de conteúdo do Drive ou uso do construtor da Lovable. As **42 evidências**, **7 frentes**, **13 eventos** e **3 referências Drive** são a linha de base anterior. Esses números devem ser relidos após o merge, em vez de presumidos.

**Próximo portão:** conferir visualmente em produção a apresentação de origens no primeiro alerta real **quando houver**, e testar revalidação/negação sob conta de ensaio autorizada, sem usar a capacidade administrativa produtiva como cobaia.
