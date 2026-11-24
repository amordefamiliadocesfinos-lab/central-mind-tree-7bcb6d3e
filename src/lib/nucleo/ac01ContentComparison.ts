/** Local, bounded text comparison. No fetch, storage, writer or authority inference. */
export const MAX_COMPARISON_BYTES=200_000;
export const MAX_COMPARISON_LINES=600;
export type ContentLine={kind:'mantido'|'incluido'|'removido';text:string};
export function compareAuthorizedText(previous:string,current:string):ContentLine[]{
 const encoder=new TextEncoder();
 if(encoder.encode(previous).length>MAX_COMPARISON_BYTES||encoder.encode(current).length>MAX_COMPARISON_BYTES)
  throw new Error('Arquivo excede o limite de 200 KB para comparação local.');
 // Compare exact lines, including CR. Do not silently normalize source bytes.
 const a=previous.split('\n'),b=current.split('\n');
 if(a.length>MAX_COMPARISON_LINES||b.length>MAX_COMPARISON_LINES)
  throw new Error('Comparação limitada a 600 linhas por versão. Use a fonte original para arquivos maiores.');
 const width=b.length+1,grid=new Uint16Array((a.length+1)*width);
 for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)
  grid[i*width+j]=a[i]===b[j]?1+grid[(i+1)*width+j+1]:Math.max(grid[(i+1)*width+j],grid[i*width+j+1]);
 const lines:ContentLine[]=[];let i=0,j=0;
 while(i<a.length||j<b.length){
  if(i<a.length&&j<b.length&&a[i]===b[j]){lines.push({kind:'mantido',text:a[i++]});j++;}
  else if(i<a.length&&(j===b.length||grid[(i+1)*width+j]>=grid[i*width+j+1]))
   lines.push({kind:'removido',text:a[i++]});
  else lines.push({kind:'incluido',text:b[j++]});
 }
 return lines;
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
