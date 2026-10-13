# Respostas — mecanismo de deploy de Edge Function (somente leitura)

Nenhuma ação foi executada; nenhum arquivo do projeto, commit, branch ou deploy foi alterado.

1. **Sim.** Os deploys anteriores de `shopee-review-auth` (30/09 e 01/10/2026) foram feitos pelo agente interno autenticado do Lovable, com a ferramenta nativa de deploy de Edge Function do backend. Não usaram o Supabase CLI. Antes de cada deploy, o agente comparou o arquivo do projeto com o commit aprovado.

2. **Não.** A ferramenta recebe apenas o nome da função. Ela não aceita branch, PR, SHA nem conteúdo de arquivo. Para publicar código de uma branch que não está na main, esse código precisa estar no projeto Lovable antes do deploy. Isso pode ser feito por sincronização do editor com a branch, como na F6-B, ou por gravação dos arquivos.

3. **Sim.** A ferramenta publica somente o código presente no projeto Lovable no momento do deploy. Isso inclui a pasta da função, os imports de `_shared` e o `supabase/config.toml` (por exemplo, `verify_jwt`).

4. **Não.** O projeto não tem controle interno de deploy que aceite snapshot ou arquivo externo congelado sem editar o projeto. Para fixar uma fonte exata, há dois caminhos:
   - sincronizar o editor com o SHA desejado e conferir o código byte a byte antes do deploy;
   - fazer o deploy fora do Lovable, com outra ferramenta e credenciais próprias, o que fica fora deste ambiente.
