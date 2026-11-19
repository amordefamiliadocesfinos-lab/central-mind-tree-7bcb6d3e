# MAPA DE CONTINUIDADE CANÔNICA DOS ESPECIALISTAS — NÚCLEO 2.0 V1.1

**Estado:** CONGELADO COMO MAPA DE PLANEJAMENTO E DIRETRIZ DE EVOLUÇÃO, por solicitação do proprietário de 19/11/2026. **Não é homologação técnica nem migração aplicada.**  
**Projeto:** PAINEL CENTRAL — AMOR DE FAMÍLIA  
**Piloto primeiro e obrigatório:** Especialista Núcleo 2.0, dentro da governança NUC  
**Fonte precedente preservada:** `docs/architecture/MAPA_CONTINUIDADE_CANONICA_ESPECIALISTAS_NUCLEO20_V1_0_CONGELADO_PLANEJAMENTO_2026-11-19.md` — não apagar, substituir ou reescrever.  
**Soberania:** Mapa Mestre Núcleo 2.0 V1.3, CA-01–CA-29, M0–M5 e portões AC-01/AC-02. Este mapa V1.1 **não** altera a autoridade do mapa soberano, não abre Entrega B e não cria direito de acesso.

## 1. Decisões de arquitetura — delta vinculante de planejamento V1.0 → V1.1

**D1 — Desacoplar quatro entidades:** `módulo` (onde a função acontece), `especialidade` (competência/domínio continuável), `especialista/instância` (agente ou pessoa que exerce papel em determinada sessão/mandato) e `frente` (trabalho M3 com status, evidência e próximo passo). Um especialista não é um módulo; uma especialidade pode atuar sem módulo operacional próprio, especialmente em governança e disciplinas transversais.

**D2 — Relações N:N sem duplicar módulos:** um módulo pode ter 1, 3, 5 ou mais especialidades e especialistas; uma especialidade pode atender vários módulos; uma frente pode envolver vários especialistas com responsabilidade primária explicitada e contribuições individualizadas. Nenhum desses números exige criar um módulo novo.

**D3 — Continuidade por especialidade + contexto de atuação:** a chave conceitual de assunção será `especialidade estável + contexto opcional de módulo + frente opcional`. A instância sucessora herda a trajetória da especialidade, mas **não** herda automaticamente sessão, mandato, senha, credencial ou autoridade do predecessor. Separar método **geral** da especialidade de adaptação **contextual** do módulo/frente.

**D4 — Acesso produtivo e não engessado:** o especialista utiliza, antes de pedir Work ou operação manual, os **conectores e instrumentos efetivamente disponíveis no chat atual** para leitura de GitHub, projeto Lovable e banco do próprio Núcleo, sempre conforme escopo e autorizações. Falta de navegador interativo não implica falta de acesso aos registros; não usar o navegador como passagem obrigatória para atividade que um conector oficial já resolve. Work é contingência **somente** para interação gráfica autenticada indispensável ou confirmação humana que a integração disponível não consegue demonstrar.

**D5 — Guardas proporcionais:** consulta autorizada é livre de aprovações repetitivas; escrita técnica de código segue branch/CI/PR; escrita documental na fonte competente exige identidade auditável, autorização, contrato suportado e readback. Aprovação de conteúdo/vigência, grants, RLS, migração, credenciais e deploy seguem seus portões soberanos. **Reduzir fricção não significa contornar RLS, service_role, autorização de terceiros ou falsificar autoria.**

**D6 — Histórico obrigatório:** preservar V1.0 e as versões de métodos, ecossistemas, decisões, aprendizados e erros/acertos relevantes. Mostrar o estado atual por padrão com linha do tempo e links ao passado. A não reprodução integral de textos antigos no pacote compacto não constitui exclusão da fonte.

**D7 — Não mudar contratos existentes sem ganho verificado:** priorizar representação compatível e reutilização de AC-01, AC-02, FM, M3/M4/M5. Nova estrutura relacional/schema só após piloto mostrar limitação material e aprovação separada da autoridade competente.

## 2. Vocabulário e modelo lógico alvo

| Entidade | Identidade | Relações | Observação de autoridade |
|---|---|---|---|
| Módulo | Código e UUID do Core M3, quando cadastrado | 0..N especialidades e frentes | NUC é governança, não exigir que especialidade seja módulo |
| Especialidade | Identificador funcional estável **a definir** após prova, sem reaproveitar o nome de chat como chave | 0..N vínculos de módulo/frente | Conhecimento/método próprio, versão, escopo e histórico |
| Especialista / instância | Papel funcional + ator/identidade real **quando comprovados** | Pode atuar em 0..N especialidades | Declaração não é mandato; sucessão preserva separação de atores |
| Vínculo de atuação | Especialidade + contexto (módulo, frente) + papel + período/estado | N:N | Responsável principal e colaboradores; sem autoridade implícita |
| Frente | Registro M3 existente | Pode envolver várias especialidades por referência | Não duplicar frente para adicionar participante |
| Contribuição de conhecimento | AC-01/versão FM + origem/linhagem | Pertence à especialidade e pode incidir sobre módulo/frente | Proposta não se torna vigente sem decisão competente |
| Evidência/checkpoint | M4 / FM-09, eventos e fontes originais | Relaciona frente e contribuição quando comprovável | Merge ≠ deploy; declaração ≠ comprovação |

**Implementação alvo não é schema aplicado.** O M3 atual armazena `specialist` como `text` singular. AC-01 armazena `specialist_role` e `module_id`; não existe nesse contrato prova de um cadastro relacional N:N completo. Evitar concatenar cinco nomes no campo `specialist` e fingir que isso resolve papéis, direitos e sucessão. Se o piloto demonstrar necessidade, propor vínculo relacional mínimo **aditivo**, com migração, RLS, testes e readback sob autorização distinta. Não migrar dados por suposição nem certificar titularidade retroativamente.

## 3. Porta 0 — identidade única e fontes competentes

- Projeto: `PAINEL CENTRAL — AMOR DE FAMÍLIA`.
- Site: `https://central-mind-tree.lovable.app`; Núcleo: `https://central-mind-tree.lovable.app/nucleo`.
- Repositório: `amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e`; branch de referência `main`, SHA atual sujeito a leitura no GitHub.
- Projeto Lovable oficial: `1720a410-34cd-4410-995c-8c92c7edf16b`.
- Banco Supabase Cloud integrado: referência `xkskyutmtlhivvpfxkjg`; **não é credencial**.
- Hierarquia de fontes: Mapa Mestre V1.3/decisões competentes → contratos e versões com fonte → Core autenticado → prova técnica atual no provedor → relatos/propostas.
- Domínios de verdade: GitHub para arquivos, commits, PR e CI; Lovable para vínculo/sincronização e publicação quando verificada; PostgreSQL Core para registros M3/M4/FM/AC-01; fontes externas originais para conteúdos e decisões que lhes pertençam.
- CI descartável ≠ produção; merge ≠ publicação; presença no GitHub ≠ contribuição AC-01 no Core; acesso a banco por integração administrativa ≠ autoria de usuário final.
- Informações estáveis podem ser herdadas do Registro Mestre AC-02; verificar **somente fatos mutáveis relevantes** (SHA, deploy, frente, sessão, vínculo, evidência) ao iniciar uma nova missão.

## 4. Portas de acesso — caminho direto primeiro

| Porta / ação | Ferramenta preferencial quando conectada e autorizada | Prova que a ferramenta realmente fornece | Limite |
|---|---|---|---|
| P0 — localizar mapa/método | GitHub/Google Drive/arquivos do projeto e leitura do Núcleo | Origem, versão e conteúdo permitido | Não autentica vigência por si só |
| P1 — inspecionar estado do Core | Conector Lovable para **SELECT** ao banco oficial, ou leitura no aplicativo sob usuário | Tabelas, UUIDs, dados retornados e recorte | SQL administrativo de leitura não representa sessão JWT do usuário |
| P2 — conferir desenvolvimento | GitHub PR/CI + Lovable projeto/arquivos + M3/M4 | Estado técnico nos provedores e Core | Sem presumir deploy |
| P3 — registrar proposta/documento no Core | UI autenticada ou escritor aplicativo explícito que preserve identidade, RLS, auditoria e readback | ID da proposta, autor verificado, estado e origem | Conector administrativo genérico que faz SQL **não** substitui escritor auditável sem contrato |
| P4 — homologar/publicar/autorizar | Fluxo competente já aprovado e prova independente | Ato, publicação e eventual fonte canônica | Não criar acesso ou promulgar vigência por comando |
| P5 — interação humana no Chrome | Navegador interativo/Work **quando necessário** | Tela, clique, confirmação e comportamento UI real | Não é requisito para consultas P0–P2 |

**Regra operacional:** antes de emitir comando Work, testar a capacidade direta disponível para o resultado solicitado. Se a consulta/edição admitida puder ser concluída por ferramenta oficial com identidade e readback, **executar diretamente**. Se somente uma etapa específica depender de UI, delegar **apenas aquela etapa**, com dados já resolvidos e sem repetir investigação. Não dizer “sem acesso ao Núcleo” quando a leitura do Core já foi comprovada por conector.

**Menor privilégio e acessibilidade:** a solução futura deve disponibilizar ao especialista uma **consulta de contexto de sua especialidade** com permissão própria e escopo limitado (p.ex. endpoint consultivo read-only dedicado), sem exigir `nucleo_manage` global para somente ler o pacote pertinente. Isso é **projeto de contrato/segurança**, não permissão criada por este mapa. Separar acessos de leitura e escrita e definir revogação/testes negativos. Nenhuma instrução daqui autoriza JWT compartilhado, `service_role` no chat, chave de API exposta ou bypass de RLS.

**Fallback proporcional:** (i) API/conector autenticado → (ii) leitura governada do próprio aplicativo → (iii) navegador/Work para interação ausente → (iv) preparar artefato e apontar precisamente o portão pendente. Nunca executar o mesmo levantamento em todas as ferramentas sem motivo.

## 5. Comando padrão A — ASSUNÇÃO MULTIESPECIALISTA (revisado)

**ATIVAR ASSUNÇÃO CANÔNICA — NÚCLEO 2.0 V1.1.** Identifique `[ESPECIALIDADE]`, `[ATOR/PAPEL]`, `[MÓDULO se existir]`, `[FRENTE se existir]` e `[MISSÃO]`. Execute Porta 0 uma vez; consulte diretamente as fontes oficiais e o Core pelos conectores já disponíveis antes de solicitar trabalho manual. Recupere método/ecossistema e versões da especialidade, vínculos e frentes relacionados, contribuições AC-01, revisões FM, evidências M3/M4, FM-09/10, erros/acertos, decisões, último checkpoint e próxima ação. Classifique `fato comprovado / versão vigente demonstrada / proposta / hipótese / não verificado`. Compare evidência atual com histórico; não refaça o que já foi concluído. Entregue cartão mínimo: identidade, especialidade, vínculo contextual, fontes/versões, riscos, frentes e IDs, checkpoint, lição útil e próxima ação única. Execute somente a ação consentida, suportada por conexão e autorização real; se faltar apenas UI, solicite Work **somente para a interação UI**, mantendo o restante já recuperado. Não herde credencial ou mandato do antecessor.

## 6. Comando padrão B — EVOLUÇÃO E REGISTRO GOVERNADO (revisado)

**ATIVAR EVOLUÇÃO GOVERNADA — NÚCLEO 2.0 V1.1.** Contexto `[ESPECIALIDADE]`, `[ATOR]`, `[MÓDULO opcional]`, `[FRENTE opcional]`, `[PROBLEMA/ACHADO]`. Leia primeiro método geral vigente (se comprovado), depois adaptações locais e fontes anteriores. Identifique se a melhoria é **global da especialidade**, **contextual do módulo** ou **restrita à frente**. Se não houver ganho material, **MANTER, NÃO CRIAR VERSÃO**. Se houver, sintetize delta `antes → problema → mudança mínima → prova → risco/custo`, proponha versão preservando ID/linhagem e origem; registre diretamente apenas pelo escritor aplicativo permitido com identidade e readback, caso disponível; senão entregue proposta vinculável sem declarar gravação. Não duplicar método em vários módulos, não substituir original nem promover vigência automaticamente. Conclua com confirmação do registro se houver, resultado, decisão pendente, checkpoint e próxima ação única.

## 7. Rotina padrão C — CHECKPOINT E SAÍDA

Em alteração material: registrar `especialidade + contexto + mudança/decisão + prova/data + método/versão afetada + erro/acerto reutilizável + estado da frente + próxima ação` no registro já existente, sem novo documento autônomo se bastar uma atualização de referência. Readback obrigatório para afirmar persistência. Sem mudança, não gerar versão nova. Cada sucessor herda o checkpoint, **não** a identidade autenticada.

## 8. Piloto único — Especialista Núcleo (NUC) com papéis relacionados

**Módulo de governança real:** `NUC` — UUID `636768e6-e782-4c7d-8132-e7381621be12`; frentes `NUC-M0` a `NUC-M5` existentes. Nenhuma duplicação.  
**Especialidade-piloto:** `Governança e Continuidade do Núcleo` — identificador funcional descritivo **proposto**, não cadastro homologado. Outras especialidades no NUC (UX/UI, backend, segurança, documentação) são **papéis candidatos**, não registros de pessoas/mandatos.  
**Autoridade:** proprietário/Camada Mestre; este chat atua como especialista funcional sem presumir titularidade certificada no Core.

**Contraprova de acessibilidade já executada (19/11/2026):**
- GitHub oficial: leitura de mapas, componentes e contratos; edição por branch/PR disponível na conexão.
- Lovable: projeto `1720a410-34cd-4410-995c-8c92c7edf16b` consultável; query `SELECT` no banco oficial retornou módulos/frentes.
- Núcleo/Core: tabela `nucleo_development_workstreams` contém NUC e M0–M5; consulta à `nucleo_specialist_contributions` retornou **zero contribuições para NUC neste recorte**.
- UI autenticada: não é requisito para essas leituras; publicação, interação visual e writer auditável do Core **não foram provados por essas consultas**.
- Endpoint `nucleo-knowledge-read` contém bloqueio expresso de `module.code==="NUC"`, voltado à consulta de módulos operacionais. A exclusão de NUC desse endpoint **não** impede leitura direta de outros registros; não remover a guarda de forma indiscriminada.

**Experimento mínimo:** usar ferramentas já conectadas para recuperar Porta 0, mapear o trabalho NUC e referenciar o mapa versionado no GitHub; em seguida testar **um único vínculo AC-01** sob contrato de escrita com identidade e auditoria. Se a infraestrutura existente não permitir, descrever a única lacuna e propor correção incremental. Avaliar uma extensão consultiva específica para NUC (sem permissões extras indevidas) antes de mudar `nucleo-knowledge-read`. Um sucessor precisa demonstrar herança real, não apenas receber texto bem formatado.

## 9. Microfrentes da implantação V1.1 (sem inflar o plano)

| Ordem | Frente | Entrega de aceite | Estado de planejamento |
|---|---|---|---|
| F0 | Mapa V1.1 + Porta 0 + comandos A/B/C | Fonte versionada e legível por qualquer especialista autorizado | Documento planejado; GitHub após PR/merge |
| F1 | Acesso direto e seguro | Consultar NUC/AC-01/M3/M4 via conexão sem dependência de Work; definir limites de writer | Leitura demonstrada; escrita de usuário não demonstrada |
| F2 | Identidade e vínculos multiespecialidade | Modelo funcional N:N + prova de 3 especialistas em 1 módulo e 1 especialidade em 2 módulos | Gap real no M3 textual singular; modelagem proposta |
| F3 | Assunção NUC e fontes do sucessor | Pacote mínimo NUC sem contornar guarda atual do endpoint; próxima ação comprovada | Contrato consultivo específico a avaliar |
| F4 | Registro de método/ecossistema e delta | Uma contribuição AC-01 com origem, papel, versão e readback; preservar método geral vs local | Teste produtivo com writer autorizado pendente |
| F5 | Aprendizagem e checkpoints | Lição de erro/acerto verificável, FM-09/10 e prova de utilidade | Reusar estruturas existentes |
| F6 | Autoridade canônica | Decisão competente e demonstração de publicação quando ocorrer | Portões pendentes; não autorizado automaticamente |
| F7 | Replicação e sucessão | Especialista sucessor distinto recupera histórico com escopo correto; escala depois do piloto | Recebimento/aceite produtivo e ledger ainda adiados |

**Ordem de desbloqueio:** F1 leitura acessível → F2 identidade sem duplicação → F3 assunção consultiva NUC → F4 escrita AC-01 segura → F5 lições → F6 portões competentes → F7 replicação. Microfrentes podem andar paralelas **quando independentes**. Não antecipar F6–F7 por conveniência. Alterações no schema/RLS dependem de revisão de segurança, testes de isolamento e decisão própria; não são autorizadas por este documento.

## 10. Critérios de aceite concretos

1. Um chat com conexão disponível lê diretamente pelo menos um módulo e frente no Core sem comando Work.
2. Um módulo comporta **3 especialistas distintos em funções próprias** e o relacionamento não exige três módulos.
3. Uma especialidade pode relacionar-se a dois módulos preservando método geral e adaptação local identificados separadamente.
4. Um novo chat recupera Porta 0, vínculo, método/versão, frente, erros/acertos e checkpoint sem receber acesso indevido.
5. Sem conexão suficiente, a ferramenta declara **qual** porta falta; não afirma indisponibilidade total do Núcleo.
6. Uma proposta AC-01 é gravada **uma única vez** via escritor com identidade real; o Core devolve ID/origem/estado e auditoria coerente. Sem writer, apenas proposta documental.
7. V1.0 e métodos anteriores permanecem acessíveis, sem exclusão ou falsa substituição.
8. CI verde, merge, publicação, mandato e vigência permanecem conceitos separados.
9. Nenhuma permissão RLS é alargada silenciosamente, nenhum serviço recebe chave privilegiada via chat e nenhuma ação em produção ocorre por inferência.
10. O custo de implantação permanece proporcional: sem biblioteca paralela, sem nova auditoria global de rotina e sem redigir documentos integrais para mudanças triviais.

## 11. Fronteiras e pendências explicitamente preservadas

- Mapa Mestre V1.3 **continua soberano**. Sua íntegra ainda requer comparação própria antes de qualquer implantação que confronte contratos originais.
- O mapa V1.0 permanece preservado como referência histórica, com suas decisões de origem; V1.1 é a **revisão de planejamento atual** que explicita os novos vínculos e acesso direto.
- AC-02 exportável atual é **rascunho consultivo**. Não cria autorização, entrega, aceite, mandato ou conexão automática.
- As propostas de ledger/histórico AC-02 e outras pendências expressamente adiadas não estão liberadas por este mapa.
- Acesso administrativo via conexão pode ser suficiente para diagnóstico e leitura, **mas não substitui prova de identidade/RLS para escritor de contribuição**.
- Evolução de controles de leitura por especialidade e writer seguro é um pedido de produto/engenharia a submeter aos portões competentes, não liberação automática.

## 12. Próxima ação única

**Piloto NUC F1/F2:** produzir cartão de assunção com as fontes diretamente acessíveis, identificar as especialidades e vínculos existentes no NUC sem fabricar registros, e especificar a menor solução **aditiva e auditável** para vincular uma contribuição AC-01 ao Especialista Núcleo. Trabalhar com GitHub/Lovable/Core por conexão; abrir Work somente se o passo remanescente realmente exigir interface gráfica. Registrar resultado com readback, sem repetir auditoria e sem avançar a homologação.

**Congelamento:** este documento é a revisão de planejamento V1.1. Qualquer nova alteração material requer delta fundamentado com histórico; nenhuma atualização na `main` deve reescrever silenciosamente V1.0.
