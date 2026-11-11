# Núcleo 2.0 — M3 | Correção de histórico redundante e responsividade
**Data:** 11/11/2026  
**Fonte de evidência:** teste real da ficha NUC-M3 e GitHub Actions PR #619.  
**Escopo:** correção da M3 existente, sem alteração de acervos, estados ou permissões.

## Diagnóstico do uso real
O formulário enviava todos os campos editáveis até quando nada havia mudado; o gatilho BEFORE atualizava `updated_at` e o AFTER inseria histórico adicional, inclusive para UPDATE sem diferença de conteúdo. Observou-se um evento de edição verdadeira e outro redundante com conteúdo idêntico em 11/11/2026. A restauração posterior foi documentada como uma alteração real e preservada.

## Correções
1. Interface compara os valores editados ao snapshot selecionado; quando não há diferença, desativa `Salvar e registrar histórico` e apresenta `Sem alterações`.
2. Quando existe mudança, envia somente campos alterados e usa controle otimista de concorrência com `updated_at`; evita sobrescrever edições recentes sem aviso.
3. Migration aditiva `20261111232500_nucleo_m3_ignore_noop_updates.sql` mantém o gatilho atual, mas cancela a atualização antes de mudar timestamps ou gerar eventos se todos os campos semânticos estiverem idênticos.
4. Central Visual amplia largura apenas no modo Desenvolvimento, preservando as oito áreas existentes; Kanban em cinco colunas estáveis com rolagem horizontal nas telas menores e ficha lateral com espaço de leitura.

## Evidência técnica
- GitHub Actions [#43108556183](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/43108556183): regressão PostgreSQL 17 e build do aplicativo **success**.
- PostgreSQL Core oficial: migration `20261111232500` aplicada e registrada em `supabase_migrations.schema_migrations`; função de auditoria conferida após aplicação.
- Ensaio transacional no Core: `UPDATE ... SET next_action=next_action` na frente NUC-M3 não alterou `updated_at` nem a contagem de eventos, seguido de rollback.
- Estado pós-aplicação: 7 frentes, 11 eventos históricos, 3 referências Google Drive, 0 documentos M1 importados e 1 concessão individual `nucleo_manage`, mantida.
- Não foram apagados históricos passados. O evento redundante preexistente permanece como evidência original.

## Portões restantes
- Merge do código e migration versionada na `main` não deve reaplicar uma versão já registrada.
- Verificação visual pós-publicação no navegador autenticado para atestar distribuição de colunas e estado desabilitado do botão sem alterações.
- Testar concorrência com duas sessões reais em fase controlada, sem perturbar dados documentais.

**Preservação:** nenhuma das 82 páginas locais, arquivos do Drive, permissões de módulos externos ou documentos da Base V1.2 foi alterada.
