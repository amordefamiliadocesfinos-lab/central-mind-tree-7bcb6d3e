// Literal criteria are extracted, never paraphrased or renumbered.
const fs=require('node:fs');
const sovereign='docs/architecture/MAPA_MESTRE_NUCLEO_2_0_V1_3_AC01_CONHECIMENTO_ESPECIALISTAS_CONGELADO_2026-11-14.txt';
const criteria=fs.readFileSync(sovereign,'utf8').split(/\r?\n/).filter(x=>/^CA-\d{2}(?: — |:)/.test(x));
if(criteria.length!==29)throw Error('Expected 29 literal sovereign criteria');
const component=name=>'src/components/nucleo/'+name+'.tsx';
const test=name=>'scripts/nucleo-'+name+'.test.cjs';
const rows=[
 ['NucleoPanoramaDinV30','ux-din01-02','Inventário Core atual e uso pelo proprietário'],
 ['NucleoCrossModuleCoverage','ux-a-plus-cross-module','Revisar lotes e cadastrar frentes reais elegíveis pelos escritores oficiais'],
 ['NucleoDevelopmentCenter','ux-din05-execution','Persistência autenticada real, autoria e readback no piloto'],
 ['NucleoDevelopmentCenter','ux-din01-02','Ensaio lista/árvore/Kanban/timeline no ambiente publicado'],
 ['NucleoAC01DocumentGovernance','ac01-document-governance','Autoridade dos documentos e publicação competente'],
 ['NucleoTechnicalEvidence','m4-github-refresh','Implantação servida e migrations efetivas não reconsultadas nesta execução'],
 ['NucleoContinuityTimeline','ux-a3b-ficha-viva-context','Prova autenticada de alteração e preservação do escopo no Core'],
 ['NucleoSupervisionPanel','m5-supervision','Atualidade de fontes reais; alerta continua consultivo'],
 ['NucleoIdentityContext','integrated-capabilities','Candidata com RLS testada em ambiente descartável; autorização de implantação/JWT real separada'],
 ['NucleoResumeBrief','ux-v26-resume','Ensaio de gestão pelo proprietário no ambiente servido'],
 ['NucleoCrossModuleCoverage','ux-a-plus-cross-module','Cobertura produtiva dos módulos não presumida a partir das referências'],
 ['NucleoTechnicalEvidence','m4-github-refresh','Ensaio de indisponibilidade do Núcleo sem interferência nos provedores'],
 ['NucleoModuleKnowledge','fm-linked-evidence','Ficha real, método/autoridade e uso autenticado verificáveis'],
 ['NucleoOperationalAtlas','ux-a-plus-crm-journey','Catálogo CRM exige confirmação das telas servidas'],
 ['NucleoGuidedJourneys','ux-a-plus-crm-journey','Observação de operador independente obrigatória'],
 ['NucleoAc02ContinuityRead','ac02-authenticated-read','Sessão individual autorizada de IA; candidata não concede acesso produtivo'],
 ['NucleoIdentityContext','integrated-capabilities','Vínculos e fontes revisados, sem converter nomes históricos em identidade'],
 ['NucleoSpecialistContributions','ac01-pending-review-bridge','Verificar mudança real e revisão humana na fonte'],
 ['NucleoDevelopmentCenter','ux-a2-navigation','Navegação integrada autenticada em uso real'],
 ['NucleoAc01ContentComparison','ux-a-plus-final-a11y','Desktop/mobile/teclado e contraste no ambiente publicado; prova local tem alcance restrito'],
 ['NucleoSpecialistContributions','ux-v24-document-drafts','Readback/autoria reais pelo escritor vigente e tratamento de falha'],
 ['NucleoCrossModuleCoverage','integrated-capabilities','22 fontes/10 módulos preparadas; cobertura operacional requer responsáveis e registros reais'],
 ['NucleoSpecialistContributions','ac01-agent-pilot','Identidade relacional candidata e piloto real autorizado'],
 ['NucleoAC01DocumentGovernance','ac01-document-governance','Duas versões reais e estado de autoridade demonstrados'],
 ['NucleoAc01ContentComparison','integrated-capabilities','Diff textual local desenvolvido; formatos sem texto e fontes sem autorização permanecem limitados a metadados'],
 ['NucleoAC01DocumentGovernance','ac01-assisted-comparison','Rascunho e revisão humana reais; nenhuma consolidação canônica automática'],
 ['NucleoAC01DecisionStatus','ac01-verified-links','Ato humano competente, publicação autorizada e readback da referência vigente'],
 ['NucleoAC01DocumentGovernance','ac01-consolidation-queue','Fila real sob sessão autorizada; ausência de registros não prova conclusão'],
 ['NucleoIdentityContext','integrated-capabilities','Candidata conecta referências AC-01/FM/M4/checkpoint ao contexto AC-02; implantação e sucessão F7 não autorizadas'],
];
let output='# Núcleo 2.0 — matriz de atendimento CA-01–CA-29 · 24/11/2026\n\n';
output+='Confronto de implementação com a fonte soberana integral, sem alterar suas 476 linhas. Fonte: ['+sovereign.split('/').pop()+']('+sovereign.split('/').pop()+'). SHA-256: `0da8ec8d44b4ad3ae0009f02d46433a29dff85877a9c923f5843955e2aa08c4f`.\n\n';
output+='A redação de cada critério abaixo é literal. Estado de engenharia não é aceite funcional. Nenhum critério recebe homologação nesta rodada. Entrega A e seus aceites anteriores preservados; A+ permanece parcial; F6/F7/B fechados. A comparação integral foi feita com a fonte fornecida pelo proprietário em 24/11.\n\n';
output+='| Critério literal | Estado real | Implementação / arquivo | Evidência reproduzível | Pendência / dependência externa |\n|---|---|---|---|---|\n';
criteria.forEach((criterion,index)=>{
 const [name,suite,pending]=rows[index];const file=component(name),evidence=test(suite);
 for(const path of [file,evidence])if(!fs.existsSync(path))throw Error('Missing matrix evidence '+path);
 const state=[8,16,28].includes(index)?'Desenvolvido; candidata testada em PostgreSQL descartável; não implantada':
  [19,21,24].includes(index)?'Desenvolvido; contraprova de código; uso real/homologação pendentes':
  'Base herdada integrada; testes de contrato; publicação/uso atual não comprovados';
 output+=`| ${criterion.replaceAll('|','\\|')} | ${state} | \`${file}\` | \`${evidence}\` | ${pending} |\n`;
});
output+='\nContraprova única: `node scripts/nucleo-final-counterproof.cjs --native-db` em PostgreSQL 17 descartável loopback, conforme workflow `nucleo-integrated-completion.yml`. Sem `--native-db`: contratos, TypeScript e build; não implica prova de banco. Resultados finais e limitações: `NUCLEO_INTEGRACAO_F1_F5_CHECKPOINT_2026-11-24.md`.\n';
fs.writeFileSync('docs/architecture/NUCLEO_CA01_CA29_ATENDIMENTO_2026-11-24.md',output);
console.log('29 literal criteria mapped; no criterion homologated.');
