# CCH E5-A — Gate de evidência longitudinal (somente contratos)

**Autoridade:** CCH v5.4 FROZEN + Evolução do Motor V1.0 FROZEN; Issue #966. **F23 não aberta.**

## Alcance técnico
`longitudinalEvidenceE5.ts` é uma função pura para **auditar suficiência descritiva** por atleta, versão, exercício, máquina e unidade. Filtra sessões incompletas, anuladas, duplicadas e cruzamentos de atletas; exige objetivo escolhido, consentimento, qualidade revisável, recuperação/dor documentadas e sinais adversos ausentes antes de liberar **somente revisão descritiva**. Duas exposições distintas representam mínimo estrutural para comparação, **não** suficiência científica ou autorização de alteração de dose.

## Limites inegociáveis
- Não lê banco, não publica, não cria draft, não toca fila, não adapta automaticamente carga nem volume.
- Mesmo `descriptive_review_only` retorna `numericIncrement:null` e `volumeChange:null`. Sem prova de eficácia, hipertrofia, causalidade, tolerância ou dose ótima.
- Perfil `advanced` preservado independente da confiança. Não infere objetivo pelo peso.
- Sem machine ID ou recuperação: bloqueio. Sem extrapolar kg para lb nem versões distintas.
- Esta entrega usa **dados sintéticos apenas nos testes**. **Não há calibração longitudinal real homologada**. Qualquer uso posterior com dados reais depende de base comparável, direitos do atleta, consentimento e avaliação contextual por especialista.

## Próxima etapa condicionada
Confrontar contratos E5-A com dados longitudinais reais de M3/M4/F13/F14/F21/F22 **somente em consultas autorizadas e isoladas por atleta**, auditando proveniência e faltantes; isso não autoriza mudança de programa ou prescrição numérica.
