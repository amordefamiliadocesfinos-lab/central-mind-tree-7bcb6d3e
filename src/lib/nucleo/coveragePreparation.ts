import sources from './coverageSourcesV13';
export {sources as COVERAGE_SOURCES};
/** Same request UUID for the same module/source bytes. Existing AC-01 writer remains sole writer. */
export async function prepareCoverageBatch(moduleCode:string,moduleId:string,declaredRole:string){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(moduleId))throw new Error('Módulo sem UUID comprovado no M3.');
 const refs=sources.filter(x=>x.moduleCode===moduleCode);
 if(refs.length===0)throw new Error('Nenhuma fonte conferida para este módulo.');
 const proposals=await Promise.all(refs.map(async source=>{
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`nucleo-coverage-v1|${moduleId}|${source.path}|${source.sha256}`)));
  digest[6]=(digest[6]&15)|128;digest[8]=(digest[8]&63)|128;
  const hex=Array.from(digest.slice(0,16),x=>x.toString(16).padStart(2,'0')).join('');
  const request_id=[hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
  return {action:'revisar_duplicidade_antes_de_inserir',source,
   payload:{module_id:moduleId,workstream_id:null,specialist_role:declaredRole.trim()||null,
    contribution_kind:'arquivo',title:source.label.slice(0,180),source_kind:'github',
    source_locator:`https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/${source.commit}/${source.path}`,
    source_checksum_sha256:source.sha256,request_id,
    note:`Inventário de fonte, não método homologado. ${source.note}`.slice(0,2000)}};
 }));
 return {contract:'nucleo_coverage_preparation_v1',state:'preparado_para_revisao',moduleCode,
  writer:'nucleo_specialist_contributions (escritor AC-01 existente)',
  pending:declaredRole.trim()?['Conferir versão/duplicidade no Core, autoria da sessão e autoridade da fonte antes de registrar.']:
   ['Preencher o papel funcional do proponente com origem verificável.','Conferir versão/duplicidade no Core e autoria da sessão antes de registrar.'],
  limitations:['Não cadastra frentes, não atribui mandato e não promove vigência.','request_id estável; repetição deve recuperar o mesmo registro pelo escritor oficial.'],proposals};
}
