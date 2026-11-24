/** Local, bounded text comparison. No fetch, storage, writer or authority inference. */
import {compareDocumentVersionsV13} from './documentDiffV13';
export const MAX_COMPARISON_BYTES=200_000;
export const MAX_COMPARISON_LINES=600;
export type ContentLine={kind:'mantido'|'incluido'|'removido';text:string};
export function compareAuthorizedText(previous:string,current:string):ContentLine[]{
 const encoder=new TextEncoder();
 if(encoder.encode(previous).length>MAX_COMPARISON_BYTES||encoder.encode(current).length>MAX_COMPARISON_BYTES)
  throw new Error('Arquivo excede o limite de 200 KB para comparação local.');
 // Compare exact lines, including CR. Do not silently normalize source bytes.
 if(previous.split('\n').length>MAX_COMPARISON_LINES||current.split('\n').length>MAX_COMPARISON_LINES)
  throw new Error('Comparação limitada a 600 linhas por versão. Use a fonte original para arquivos maiores.');
 const result=compareDocumentVersionsV13(previous,current,{maxChars:MAX_COMPARISON_BYTES,
  maxLines:MAX_COMPARISON_LINES,preserveLineEndings:true});
 if(result.state!=='completo')throw new Error(result.reason);
 return result.lines.map(row=>({kind:row.kind==='igual'?'mantido':row.kind,text:row.value}));
}
export async function readComparisonFile(file:File,expectedHash?:string|null){
 if(file.size>MAX_COMPARISON_BYTES)throw new Error('Arquivo excede o limite de 200 KB.');
 if(!/\.(txt|md|csv|json|sql|ya?ml)$/i.test(file.name))throw new Error('Formato sem diff confiável. Selecione texto UTF-8.');
 const bytes=await file.arrayBuffer();
 const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
 if(text.includes('\0'))throw new Error('Conteúdo binário não suportado.');
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 const sha256=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
 if(expectedHash&&(!/^[a-f0-9]{64}$/i.test(expectedHash)||expectedHash.toLowerCase()!==sha256))
  throw new Error('SHA-256 diverge do checksum registrado. Comparação bloqueada.');
 return {text,sha256,originVerified:!!expectedHash};
}
