# CCH E2 — paridade da prévia com Publication Gate F22

Mapa v1.0 FROZEN mantido; nenhum motor/fila nova e sem F23.

**Achado:** a tela considerava todas as sessões para publicação, enquanto o F22 soberano consulta apenas `status='active'`. Isso podia indicar incorretamente "estrutura pronta" ou "estrutura incompleta".

**Correção:** a UI usa helper puro `assessDraftPublicationStructure` que avalia exclusivamente sessões ativas e seus exercícios; alinha limites com a função F22 e continua mostrando resultado **consultivo**. O gate definitivo permanece o PostgreSQL F22, sem alterações.

**Contraprova:** fixture PostgreSQL com exercício e sessão ativa, casos de nenhuma sessão ativa, prescrição obrigatória incompleta, RIR acima do limite, e acesso cruzado bloqueado. O workflow **extrai a função real** `health_f22_assert_program_version_structure` da migração original e a executa, sem reimplementá-la. Testes de unidade da UI cobrem sessões desabilitadas, vazias, RIR e opcionais.

**Limite:** não executa fluxo visual autenticado com publicação real. A homologação ponta a ponta permanece pendente; E3 continua bloqueada até aceite E2.
