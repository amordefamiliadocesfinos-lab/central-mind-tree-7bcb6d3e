# Repasse Camada Mestre → Especialista Saúde/CCH — Rafaela / 09-11-2026

## Fonte e situação real
Painel Central, repositório oficial `amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e`, `main`. Mapa soberano vigente de Saúde/CCH continua governando a evolução técnica; este documento é **checkpoint de uso real**, não cria novo mapa ou regra funcional.

A Rafaela Campos acessou a interface `/saude/hoje` usando a própria identidade: screenshot de 09/11/2026, com seu nome, jornada, perfil/objetivo e programa de treino disponíveis. A primeira tentativa de gravação de módulo apresentou erro na UI, mas a Camada Mestre reconciliou diretamente no Supabase oficial:
- Auth existente (e-mail `camposrafaela942@gmail.com`), ligado ao `app_users` existente, `access_model='scoped'`, ativo;
- `health_athletes` existente vinculado à mesma identidade; sem duplicação;
- `app_user_module_grants`: **somente `saude`**;
- supervisor original permanece titular e com acesso ativo;
- antes/depois conferidos: **1 programa** e **8 entradas da fila CCH** preservados;
- há registro de login no Auth e renderização da página Saúde. Não significa testes completos de segurança.

## O que o Especialista Saúde deve fazer em seguida
1. **Herdar** mapa e checkpoint sem recriar Rafaela, atleta, perfil, programa, fila nem uma nova versão de CCH.
2. Validar no uso real o percurso **Hoje → Treino → Execução → Registro → Histórico**, respeitando as frentes e gates do mapa soberano.
3. Observar qualquer diferença entre o programa publicado e a fila; relatar fatos verificáveis, sem sobrescrever registros.
4. Usar GitHub direto; não usar construtor Lovable. Mudanças apenas em frentes Saúde e mediante os gates técnicos vigentes.
5. Segurança: não confundir tela restrita com isolamento de REST/RPC/Storage/Edge Functions; pendências de RLS empresarial permanecem sob Camada Mestre.

## Fronteiras e dependências
O erro genérico de salvar módulos na administração é tratado pela Camada Mestre em PR separada, **não é tarefa do especialista Saúde**. Não compartilhar senha temporária, token ou informação pessoal sensível em documentação. Entrega esperada do especialista: checkpoint objetivo com etapa corrente do mapa, próximas ações e resultados de uso real sem duplicidade documental.
