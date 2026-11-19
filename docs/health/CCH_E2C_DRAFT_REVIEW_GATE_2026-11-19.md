# CCH E2C — contrato de edição de prescrição, diff e motivo obrigatório

Subentrega rigorosamente dentro de E2 do `CCH_MAPA_EVOLUCAO_MOTOR_V1_0_FROZEN_2026-11-18.md`; respeita v5.4, M3/M4/F21/F22 e proibição de abrir F23.

## Ajuste
O editor M3 não grava mais diretamente séries, repetições, RIR e descanso na frente E2. Ele chama um RPC `SECURITY INVOKER` que exige proprietário com direito de escrita, versão explicitamente esperada e **draft**, snapshot exato dos valores anteriores (evita atualização baseada em tela desatualizada), campos permitidos, valores dentro do esquema M3 e motivo de 10 a 500 caracteres. O RPC escreve a diferença antes/depois e justificativa em `prescription_notes` no rascunho.

Valores ainda incompletos podem permanecer em draft, sem antecipar o gate F22: a publicação continua exigindo o contrato estrutural obrigatório. O RPC E2C não publica, não cria filas, nem altera M4/histórico.

## Contraprova descartável
Aplicar fixture sintético, migração E2B real, migração E2C real e contratos. Verificar: mudança autorizada, diff, justificativa, RLS de dois atletas, versão publicada, ID divergente, snapshot obsoleto, campos extras, valores fora dos limites, motivo curto, imutabilidade das filas/sessões.

## Pendência
Este teste não comprova navegação autenticada de ponta a ponta nem gate F22 completo em conjunto com UI; essas verificações permanecem necessárias para homologação integral E2. Não iniciar E3 sem aceite correspondente.
