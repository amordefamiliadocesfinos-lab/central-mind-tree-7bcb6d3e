# CCH E2B — substituição e ordem em rascunho M3

Mapa v1.0 FROZEN intacto; v5.4 soberano; F23 não aberta.

O catálogo contém equivalências *provisórias*. A interface só mostra alternativas explicitamente ligadas a um exercício pelo catálogo, ativas e com músculo principal em comum; isso não atesta equivalência biomecânica/terapêutica. O atleta precisa escolher e confirmar a troca, informando justificativa. Exercícios não equivalentes não são sugeridos.

Reordenação: prévia entre vizinhos da MESMA sessão. A aplicação é uma única transação PostgreSQL (posição temporária) para respeitar unique(session_template_id,sequence_order); não muda agenda, filas, programas publicados ou registros executados. O editor não infere benefício pelo simples fato de trocar a ordem.

O RPC security invoker verifica identidade autenticada, atleta, rascunho M3, sessão, relação de equivalência, músculo principal, operação e justificativa. A decisão é escrita em `prescription_notes`. Não há alterações automáticas nem publicação.

Testes puros cobrem alternativas filtradas, equivalência provisória, músculo primário, status ativo, troca adjacente, limites e ordens inválidas. A homologação autenticada específica de SQL/RLS e prova da jornada ainda são pendentes: CI não as substitui.
