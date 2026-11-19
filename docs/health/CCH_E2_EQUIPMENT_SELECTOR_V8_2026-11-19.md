# CCH E2 — incremento de carga por máquina comprovada (UI)

**Autoridades:** Mapa soberano v5.4 FROZEN, V1.0 FROZEN, E2; não abrir E3/F23.

## Achado
O formulário de incremento ainda listava `assessment.equipment_load_candidates` (campo legado V7) apesar de o `health_cch_assess_cycle_v10` disponibilizar auditoria específica de máquinas V8 em `equipment_provenance.evidence`. Assim, o seletor podia ficar vazio ou induzir cadastro manual sem identidade observada.

## Correção estritamente frontend
- Derivar opções **somente** de `equipment_provenance.evidence`: exercício, máquina, unidade e exposição confirmados.
- Mostrar a identidade de máquina e unidade como um único item, sem campo livre para inventar equipamento ou unidade.
- Desabilitar registro quando não houver evidência; explicar que a confirmação deve ocorrer no treino em andamento antes das séries, conforme RPC V8 existente.
- Não inventar incremento, não presumir que `candidate_load` esteja disponível e não mudar o backend `health_cch_save_load_increment`.
- O backend V7 registra uma configuração por exercício; a UI avisa que uma outra máquina precisa de revisão explícita. Não afirmar que múltiplas configurações coexistem.

## Provas
Helper puro e testes sintéticos cobrem ausência de máquinas, opções separadas por rótulo/unidade, deduplicação, rejeição de evidência inválida. CI compila e executa lint/build. Homologação com atleta real exige consentimento e utilização regular; nenhuma escrita nesta entrega.

**Auditoria Lovable Cloud somente leitura (19/11/2026):** 0 equipamentos confirmados, 0 incrementos reais, 0 drafts. Não atribuir equipamento retroativamente aos registros existentes.
