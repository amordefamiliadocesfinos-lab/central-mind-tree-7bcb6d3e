# CCH F24 — G3/P3 · Contrato de Biblioteca Visual e Protótipo Isolado V0.1
**Data:** 23/11/2026 · **Estado:** PROPOSTA TÉCNICA / PROTÓTIPO NÃO CONECTADO · **Portão G3:** somente projeto e protótipo, sem persistência nem deploy.
**Autoridades:** CCH v5.4 FROZEN; Evolução do Motor V1.0 FROZEN; deliberação F24 da Camada Mestre na PR #1022; Issue #966.
**Invariantes:** F23 fechada, E5 real bloqueada, M2/M3/M4/F19/F21/F22 preservados. Checkpoint histórico de 23/11: G1/G2 posteriormente integradas por #1025/#1027; autoridade atual: Mapa Soberano Unificado V6.0 FROZEN, U04/G3.

## 1. Decisão de produto já aprovada
D1: mostrar **somente ícone acessível “Ver movimento”** no card ativo F19; nenhuma miniatura de exercício ou aparelho permanente.
D5: no visualizador aberto sob demanda, oferecer imagem estática e vídeo curto silencioso (MP4/WebM) ou GIF curto. **Sem autoplay**, sem mídia bloqueando cronômetro, sem loop forçado, sem download/upload aberto. Controle de iniciar/pausar/fechar; quando GIF não permitir pausa real, esconder/retirar GIF ao pausar e manter alternativa estática. Respeitar `prefers-reduced-motion`: mídia em movimento desativada por padrão e ação explícita necessária; imagens alternativas e descrição textual sempre disponíveis.

## 2. Inventário existente e proposta de integração
- **M2 soberano:** `health_exercises.id`, `health_equipment_catalog` e `health_exercise_equipment`, expostos por `useHealthCatalogs.ts`. Não duplicar catálogo de exercícios; referências serão feitas por ID de exercício e, quando necessário, `equipment_id` válido da M2.
- **F19:** `HealthWorkoutInteractiveTimerF19.tsx` já controla estados da sessão. Futuramente integrará apenas ícone com ação de abrir preview; protótipo G3 não modifica o componente em execução.
- **V8 de proveniência:** `health_cch_workout_equipment` contém rótulo confirmado para comparações históricas, **não é catálogo de fotos** nem identidade canônica de variante. Não equiparar nomes de aparelho por texto livre para escolher vídeo específico.
- **Outros buckets/migrations:** existem armazenamentos de outros módulos, mas não autorizam reaproveitar bucket privado de documentos, etiqueta ou WhatsApp para imagens de saúde. **Nenhum bucket novo ou reaproveitado é liberado por esta proposta**.

## 3. Identidade do material, versão e cardinalidade (modelo futuro apenas)
Entidade conceitual `ExerciseMedia`:
`media_id` (UUID), `exercise_id` (FK M2 obrigatória), `equipment_id` (FK M2 opcional), `variant_code` (identificador editorial opcional, não rótulo livre do atleta), `kind` (`image|video|gif`), `locale` (`pt-BR` inicialmente), `title`, `description`, `alt_text`, `captions_text` (transcrição/instruções em texto), `storage_ref` **opaco**, `mime`, `size_bytes`, `width`, `height`, `duration_ms` opcional, `poster_media_id` opcional, `sha256`, `license_id`, `author`, `source_url`, `rights_proof_ref`, `reviewed_by`, `reviewed_at`, `safety_reviewed_at`, `version`, `status` (`draft|in_review|approved|retired`), `created_at`, `updated_at`.
- Material **não pode ser exibido** se ausentes: exercício válido, direito de uso verificável, atribuição exigida, revisão editorial de movimento e status `approved`; fallback para texto do exercício quando inexistente.
- Alterações editoriais geram nova versão/identificador; retirar conteúdo não reescreve histórico de treino. Somente versão aprovada e publicada manualmente aparece ao usuário.
- **Resolver variante:** primeiro `exercise_id+equipment_id+locale` com referência M2 confiável, depois `exercise_id+locale` com rótulo “demonstração geral”; nunca concluir que máquina A = máquina B pelo nome digitado.

## 4. Contrato de formatos e controles de mídia
- Preferir imagem estática WebP/AVIF (fallback PNG/JPEG) e clipe MP4 (H.264) ou WebM, silenciado e com `controls` nativo, `preload=none`, `autoPlay=false`, `playsInline`, `loop=false` por padrão. O vídeo **não inicia** apenas por abrir modal.
- GIF apenas onde houver motivo editorial: não garante pausabilidade/frame precisa; renderizar GIF somente mediante clique “Reproduzir”, remover ao “Parar” e oferecer poster estático. Não carregar GIF automaticamente. Para `prefers-reduced-motion`, oferecer imagem por padrão sem autoplay.
- Proposta inicial de orçamento (não provisionada): imagem <= 500 KiB, vídeo <= 4 MiB / <= 12 s, GIF <= 1.5 MiB / <= 6 s, max 1280×720, sem áudio. Valores são **hipóteses** para validação de rede, codec e dispositivo, não limites já implementados.
- Lazy-load apenas após clique; prévia não afeta contagem de séries, background timer nem navegação; fechar para o ícone acionador com foco restaurado e `Escape`. Sem animações essenciais para entender exercício.
- Descrição curta: posicionamento inicial, padrão de movimento, amplitude tolerada, erros comuns, precauções gerais, alternativas. Não diagnosticar postura do aluno pela demonstração.

## 5. Direitos, revisão e proveniência: fluxo editorial obrigatório
`proposto → conferência de identidade M2 → arquivo seguro → comprovação de direitos → revisão didática/técnica → revisão de acessibilidade → aprovado → publicação humana → aposentado`.
- Origem permitida somente após política aprovada: produção própria com autorização de modelo/locação; mídia licenciada com permissão explícita de armazenamento, edição e distribuição; domínio público documentado. **Foto achada em pesquisa ou rede social não confere direito de uso.**
- Guardar comprovante de licença e duração da autorização, fontes, autor, data e atribuição. Retratos de pessoas exigem consentimento apropriado. Nenhum rosto/corpo de atleta real do sistema é exemplo automático.
- Revisão de execução por profissional competente, com ficha de equipamento/posição/objetivo, técnica e nota da qualidade de evidência. Conteúdo não é avaliação individual de biomecânica.

## 6. Arquitetura de Storage/RLS FUTURA — decisão pendente, nenhuma execução
1. Propor namespace/bucket exclusivo da biblioteca editorial (não criar agora), com leitura de materiais aprovados via rota autenticada ou política explicitamente revisada; manter originais e comprovantes de direito em área privada distinta da distribuição.
2. Escrita/remoção apenas por papel editorial com MFA quando aplicável, auditoria e duplo controle de publicação; atleta recebe **somente leitura**, sem upload e sem editar metadados.
3. Contrato de autorização com autenticação, RLS/ACL e URLs assinadas de curta duração se o catálogo for privado; garantir não-exposição de arquivos em status draft/retired e revogação de links/caches.
4. Upload futuro exige MIME real + magic bytes, tamanho, duração, extensão padronizada, proteção contra SVG/script ativo, malware e descompressão excessiva, hashes, transcodificação segura, metadados EXIF removidos, rate limit e revisão humana.
5. Definir retenção, revogação de licenças, remoção auditável, backups, orçamento, cache/CDN, custos de tráfego e eventuais transferências de dados com Segurança e Camada Mestre.
6. SQL/RLS/migrations/buckets/uploads ficam estritamente em **proposta** até autorização independente de G3 produtivo.

## 7. Protótipo isolado (não integrado)
Contrato puro em `src/modules/health/cch/f24MediaPrototype.ts` e suíte `scripts/health-cch-f24-p3-prototype.test.mjs` verificam se uma mídia pode **ser candidata** a exibição: licença comprovada, revisão aprovada, ID do exercício M2 correspondente, status `approved`, formato permitido e correspondência de equipamento estrita. Não contém URL, credencial, storage, imagens ou registros reais e não renderiza conteúdo na aplicação. Wireframe de F19 planejado:

```text
┌───────────────────────────────────────┐
│  <  Supino máquina         (▶ i)   > │  somente ícone Ver movimento
│  Série 3/3 | RIR 2 | descanso 02:00   │
│  [ cronômetro / resultado / ações ]   │
└───────────────────────────────────────┘
       clique no ícone
┌───────────────────────────────────────┐
│ Ver movimento                  [X]    │
│ [imagem estática do aparelho]         │
│ [Ver vídeo silencioso] [Pausar]       │
│ Início · movimento · cuidados         │
│ [Fechar e retornar ao exercício]      │
└───────────────────────────────────────┘
```
Esta ilustração é **wireframe documental**, sem arquivo visual real. Não há integração com a página do atleta na etapa G3.

## 8. Matriz de aceite G3 e portão posterior
| Código | Contraprova | Estado deste pacote |
|---|---|---|
| P3-A01 | D1 ícone único, nada reproduz na abertura | especificado; UI autenticada não testada |
| P3-A02 | D5 imagem+vídeo/GIF silencioso, legendas/alt, fallback | especificado; ativos ainda não selecionados |
| P3-A03 | Identidade do exercício/equipamento com fallback sem inferência | contrato puro testável |
| P3-A04 | Licença, autoria, atribuição e revisão humana | política proposta, evidência material pendente |
| P3-A05 | Orçamento/rede/movimento reduzido/teclado | metas de ensaio, não homologadas |
| P3-A06 | Storage privado, grants/RLS, retenção, uploads | desenho, **aprovação separada** |
| P3-A07 | F19/M4/M3 e atletas inalterados | diff apenas documentos, helper e teste |

**Portão de entrada na implementação produtiva:** Camada Mestre aprovar arquitetura final de mídia e custos, natureza da licença, evidências da revisão, persistência/Storage/RLS, UI e critérios de implantação. A deliberação F24 G3 de 23/11 **não** concede essa autorização.


## 9. Continuidade U04 — protótipo interativo isolado (24/11/2026)
Autorização: V6.0 FROZEN e decisão do proprietário de avançar em U04, reservando contraprovas para a sequência final. `scripts/health-cch-f24-p3-preview/index.html` é uma página HTML autônoma, fora do bundle produtivo, sem rede, API, Storage ou dados reais. Abre por ícone acessível, modal nativo com Escape e retorno de foco, cenários sintéticos de variante confirmada/geral/ausente, marcador gráfico abstrato sem alegação didática real, simulação de movimento iniciada explicitamente e interrompível, respeito à preferência de movimento reduzido e cronômetro simulado independente. Nenhuma mídia real ou integração F19. Abrir o HTML localmente para revisão futura. O seletor de cenários é fixture manual, não consulta M2 nem invoca o seletor puro de elegibilidade. Critérios P3-A01/A02/A05 passam de wireframe para implementação candidata de interação; permanecem não homologados. P3-A03/A04/A06 e integração real seguem portões originais. Contraprova final deverá validar foco, Escape, fechamento, ausência de autoplay, pausa, fallback, movimento reduzido, responsividade e timer, sem promover o protótipo a produção.
