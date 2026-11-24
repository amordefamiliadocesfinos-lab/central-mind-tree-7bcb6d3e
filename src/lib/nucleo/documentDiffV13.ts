/**
 * AC-01 CA-25 — diff textual local, determinístico e conservador.
 * Nunca envia conteúdo a serviços externos. Recusa textos grandes e
 * evita apresentar comparação parcial como se fosse integral.
 */
export type DiffLineV13={kind:"igual"|"incluido"|"removido";value:string};
export type DiffResultV13={
  state:"completo"|"indisponivel";
  reason:string;
  lines:DiffLineV13[];
  included:number;
  removed:number;
};
const MAX_CHARS=12000;
const MAX_LINES=180;
export function compareDocumentVersionsV13(before:string,after:string,options?:{
  maxChars?:number;maxLines?:number;preserveLineEndings?:boolean;
}):DiffResultV13{
  // Existing FM defaults stay unchanged; authorized local files reuse this engine.
  const maxChars=Math.min(options?.maxChars??MAX_CHARS,200000);
  const maxLines=Math.min(options?.maxLines??MAX_LINES,600);
  const unavailable=(reason:string):DiffResultV13=>({state:"indisponivel",reason,lines:[],included:0,removed:0});
  if(before.length>maxChars||after.length>maxChars){
    return unavailable(`Texto excede ${maxChars.toLocaleString('pt-BR')} caracteres: comparação integral indisponível. Consulte as versões na fonte original.`);
  }
  const left=(options?.preserveLineEndings?before:before.replace(/\r\n/g,"\n")).split("\n");
  const right=(options?.preserveLineEndings?after:after.replace(/\r\n/g,"\n")).split("\n");
  if(left.length>maxLines||right.length>maxLines){
    return unavailable(`Documento excede ${maxLines} linhas: não gerar diferenças parciais.`);
  }
  const matrix=Array.from({length:left.length+1},()=>new Uint16Array(right.length+1));
  for(let i=left.length-1;i>=0;i--){
    for(let j=right.length-1;j>=0;j--){
      matrix[i][j]=left[i]===right[j]?matrix[i+1][j+1]+1:
        Math.max(matrix[i+1][j],matrix[i][j+1]);
    }
  }
  const lines:DiffLineV13[]=[];
  let i=0,j=0,included=0,removed=0;
  while(i<left.length||j<right.length){
    if(i<left.length&&j<right.length&&left[i]===right[j]){
      lines.push({kind:"igual",value:left[i]});i++;j++;
    }else if(j<right.length&&(i===left.length||matrix[i][j+1]>=matrix[i+1][j])){
      lines.push({kind:"incluido",value:right[j++]});included++;
    }else{
      lines.push({kind:"removido",value:left[i++]});removed++;
    }
  }
  return {state:"completo",reason:"Comparação textual por linhas; não detecta conflitos de autoridade ou equivalência semântica.",lines,included,removed};
}
