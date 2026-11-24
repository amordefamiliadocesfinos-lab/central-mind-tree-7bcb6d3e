import {useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import type {Ac01Record} from '@/lib/nucleo/ac01DocumentGovernance';
import {compareAuthorizedText,readComparisonFile,type ContentLine} from '@/lib/nucleo/ac01ContentComparison';

export default function NucleoAc01ContentComparison({previous,current}:{previous:Ac01Record;current:Ac01Record}){
 const [files,setFiles]=useState<{previous:File|null;current:File|null}>({previous:null,current:null});
 const [allowed,setAllowed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [result,setResult]=useState<{lines:ContentLine[];before:string;after:string;verified:boolean}|null>(null);
 const generation=useRef(0);
 function clear(){generation.current++;setResult(null);setError('');setBusy(false);}
 async function compare(){
  if(!allowed||!files.previous||!files.current||busy)return;
  const request=++generation.current;setBusy(true);setError('');setResult(null);
  try{
   if(previous.module_id!==current.module_id||previous.lineage_id!==current.lineage_id||
    current.parent_revision_id!==previous.id||current.version_no!==previous.version_no+1)
    throw new Error('Versões sem anterioridade comprovada neste recorte.');
   const [a,b]=await Promise.all([readComparisonFile(files.previous,previous.source_checksum_sha256),
    readComparisonFile(files.current,current.source_checksum_sha256)]);
   const lines=compareAuthorizedText(a.text,b.text);
   if(request===generation.current)setResult({lines,before:a.sha256,after:b.sha256,verified:a.originVerified&&b.originVerified});
  }catch(e){if(request===generation.current)setError(e instanceof Error?e.message:'Não foi possível comparar os arquivos.');}
  finally{if(request===generation.current)setBusy(false);}
 }
 return <section className="rounded-md border p-3 space-y-3" aria-label="Comparação local de conteúdo autorizado">
  <h5 className="font-semibold">Comparar conteúdo de duas versões</h5>
  <p className="text-xs text-muted-foreground">Selecione cópias autorizadas dos originais em texto UTF-8, até 200 KB e 600 linhas por versão. Os arquivos são lidos somente neste navegador.</p>
  <div className="grid gap-3 sm:grid-cols-2">{(['previous','current'] as const).map(side=><label key={side} className="text-xs space-y-2 min-w-0">
   <span className="block">{side==='previous'?`Anterior · v${previous.version_no}`:`Atual · v${current.version_no}`}</span>
   <input type="file" accept=".txt,.md,.csv,.json,.sql,.yaml,.yml" className="block w-full text-xs"
    onChange={e=>{clear();setFiles(old=>({...old,[side]:e.target.files?.[0]??null}));}} />
  </label>)}</div>
  <label className="flex gap-2 items-start text-xs"><input type="checkbox" checked={allowed}
   onChange={e=>{clear();setAllowed(e.target.checked);}} />Tenho autorização para consultar e comparar estes arquivos.</label>
  <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline"
   disabled={!allowed||!files.previous||!files.current||busy} onClick={()=>void compare()}>{busy?'Comparando…':'Comparar textos'}</Button>
   <Button type="button" size="sm" variant="ghost" onClick={clear}>Limpar resultado</Button></div>
  {error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
  {result&&<div className="space-y-2">
   <p role="status" className="text-xs">{result.lines.filter(x=>x.kind==='incluido').length} linha(s) incluída(s), {result.lines.filter(x=>x.kind==='removido').length} removida(s). Alterações aparecem como remoção e inclusão.</p>
   <p className="text-xs">{result.verified?'Checksums coincidem com os registros consultados.':'Origem dos arquivos declarada pelo usuário; sem dois checksums registrados, a correspondência com as versões não está comprovada.'} A comparação não certifica vigência ou resolve conflitos de autoridade.</p>
   <details className="text-xs break-all"><summary>SHA-256 dos arquivos comparados</summary><p>Anterior: {result.before}</p><p>Atual: {result.after}</p></details>
   <div className="max-h-96 overflow-auto rounded border" tabIndex={0} aria-label="Diferenças textuais">
    {result.lines.map((line,index)=><div key={index} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2 border-b p-2 text-xs">
     <span className="font-medium">{line.kind}</span><pre className="whitespace-pre-wrap break-words font-mono">{line.text||' '}</pre>
    </div>)}
   </div>
  </div>}
 </section>;
}
