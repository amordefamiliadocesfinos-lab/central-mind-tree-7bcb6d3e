# Núcleo 2.0 V1.1 — F2 | Contraprova isolada do modelo multiespecialidade

**Natureza:** análise do contrato existente e teste puramente em memória. **Não é schema aplicado, homologação, grant, mandato, nem prova de três atores reais.**  
**Autoridade:** Mapa Mestre Núcleo 2.0 V1.3 / Mapa de Continuidade Canônica V1.1 (D1–D7, F2).  
**Ambiente inspecionado:** GitHub `amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e` e SELECT no Lovable Cloud `xkskyutmtlhivvpfxkjg`, via projeto `1720a410-34cd-4410-995c-8c92c7edf16b`, em 19/11/2026.

## Achado material

- `nucleo_development_workstreams` representa módulo/frente com chave `id`, `parent_id`, `code`, e **um campo de texto `specialist`**. Isso não representa associações individuais N:N nem períodos de atuação.
- `nucleo_specialist_contributions` permite `module_id`, `workstream_id` opcional e `specialist_role` textual; registra origem, linhagem, autoria auditada e autoridade documental, **não** identidade estável de especialidade + participante distinto.
- `nucleo_specialist_mandate_records` permite `module_id`, `specialist_role` e `specialist_auth_uid` opcional, com ato formal próprio; não é substituto para vínculos de competência. Criar vínculo não pode criar mandato.
- A consulta atual identifica dez módulos reais, incluindo `NUC` e `CRM`, sem demonstrar instâncias de especialistas vinculadas a uma mesma especialidade.
- Nenhum dos campos identificados comprova sozinho um cadastro relacional N:N. Não usar `specialist` concatenado nem renomear frentes/módulos para simular relações.

## Ensaio funcional seguro e reprodutível

`node scripts/nucleo-f2-identity-links-model.test.cjs` usa **somente objetos sintéticos em memória** com identificadores `actor-*`, fontes `synthetic://` e métodos `test-*`.

Testa duas cardinalidades exigidas no mapa:
1. Três instâncias distintas exercendo papéis explícitos em **um módulo** `NUC` sem criar módulos duplicados.
2. **Uma especialidade** `gov-nuc` associada a `NUC` e `CRM`, preservando um método geral único e adaptações contextuais separadas.

Os testes negativos recusam link duplicado, especialidade/módulo inexistente, frente de outro módulo e tentativa de atribuir autoridade através da relação. A operação de simulação de sucessor retorna conhecimento/método, **nunca** sessão, grant, mandato ou aceite, e não cria automaticamente vínculo para ele.

**Critério técnico parcialmente satisfeito:** a cardinalidade e as invariantes são viáveis como modelo funcional independente. **Ainda não foi demonstrada no Core** a existência de 3 especialistas autorizados e 1 especialidade formal em 2 módulos; isto fica explicitamente pendente do portão de schema/autorização.

## Menor representação aditiva proposta — não executar

Quando a Camada Mestre autorizar separadamente o desenho relacional e a revisão de segurança, preferir uma implementação mínima separando:
- `specialty`: código funcional estável, título, estado, proveniência e referência de método **geral**, versionada.
- `specialist_instance`: ID da instância funcional e vínculo opcional a identidade autenticada verificada; declaração de ator não implica mandato.
- `specialty_assignment`: referências à especialidade, instância, módulo opcional, frente opcional, papel primário/colaborador, período/estado e referência de método/adaptação **local**; constraints de unicidade, integridade de frente e escopo.
- Referências às fontes AC-01, FM, M3 e M4 existentes, sem copiar corpo integral dos métodos e sem reescrever legado. Preservar versões e histórico.
- Leitura RLS por vínculo de competência e contexto autorizado, distinta de concessão de escrita, com casos negativos de cross-module e revogação. Escrita auditável e não-privilegiada por contrato específico; **não** usar SQL administrativo para simular autoria.

Isso é **especificação conceitual**, não decisão de tabela física: nomes, chaves, cardinalidade final, índices, políticas, migrations e interface exigem revisão própria. Não migrar registros antigos atribuindo identidade retroativamente. Validar riscos e preferir reaproveitar estruturas existentes onde couber.

## Portões e saída

**F2 — modelo isolado:** pronto para avaliação de engenharia com teste reprodutível após CI.  
**F2 — dados reais / N:N persistente:** pendente de deliberação separada, migration e RLS; não autorizado por este artefato.  
**F3 AC-02 consulta NUC:** mantém-se aprovado, sem aceitar sucessão formal.  
**F4 AC-01:** contribuição `80f64bfb-cfa0-4012-a2ad-b75226881c2d` permanece v1 `proposta`.  
**F6/F7:** não avançar sem seus portões.

**Próxima ação única:** aferir este modelo isolado pela CI, documentar divergências/limites e submeter a eventual necessidade de schema à Camada Mestre sem aplicar mudanças em produção.
