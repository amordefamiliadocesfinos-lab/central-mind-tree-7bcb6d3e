# Núcleo AC-02 — F3 consultivo | escopo NUC

**Mapa:** Continuidade Canônica dos Especialistas Núcleo 2.0 V1.1.  
**Soberania:** Mapa Mestre Núcleo 2.0 V1.3 — Entrega A+.  
**Piloto antecedente:** AC-01 F3 aprovado; contribuição `80f64bfb-cfa0-4012-a2ad-b75226881c2d`, estado `proposta`.

## Contrato e limites

O endpoint adicional `nucleo-ac02-context-read`, distinto do `nucleo-knowledge-read` operacional, aceita **apenas** POST JSON `{"module_id":"636768e6-e782-4c7d-8132-e7381621be12"}`. Não se remove a exclusão de NUC no leitor operacional.

A função exige JWT individual com validação Auth server-side e `nucleo_manage` ativo, conferido em `app_admin_capabilities`, e usa a ANON KEY e o JWT do chamador no acesso RLS. Sem `service_role`, escrita, credenciais de terceiros ou novas concessões.

O contexto retornado contém: identidade NUC, especialidade funcional **descritiva**, estado **consultivo e não homologado**, fonte/ID da única proposta AC-01 registrada, seis frentes NUC-M0…M5, estados e próximas ações M3, contagens M4 acessíveis sob RLS, horário de leitura e limites explícitos. Se módulo, seis frentes, registro ou contagens estiverem ausentes/parciais ou consulta RLS falhar, falha fechada; não afirma ausência de histórico.

Por desenho **não** retorna corpos de documentos, conteúdo FM, snapshots, URLs privadas, anotações M4, autores de terceiros ou segredos. Não é um contrato de recepção/aceite nem prova de sucessor distinto. O mapa V1.1 segue proposta; a especialidade ainda não possui cadastro funcional estável.

O UI `NucleoAc02NucContextRead` aparece apenas na ficha M3 NUC e exige clique explícito para consulta. O componente AC-01 permanece intacto. Sem writer, schema ou RLS novo.

## Portões de verificação

1. CI estrutural/negativa, TypeScript e build.
2. Merge do contrato não equivale a deploy. Implantar isoladamente a função no Lovable Cloud canônico com `verify_jwt=true`.
3. Requisição sem JWT deve retornar 401 e não transferir dados.
4. Publicar a revisão da UI e testar, em sessão real autorizada, a leitura do NUC e o retorno do checkpoint da contribuição AC-01 e frentes M3/M4.
5. Confirmar que um usuário sem concessão recebe 403 e que nenhuma escrita ocorre.
6. Prova com **sucessor distinto** requer autenticação e autorização próprias, sem herdar sessão/mandato; **não** criar esse ator para o piloto.

Não declarar F7, vigência, homologação, entrega, recebimento ou aceite com base em consulta bem-sucedida.
