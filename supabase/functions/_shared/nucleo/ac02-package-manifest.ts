/**
 * AC-02 / Núcleo V1.3 — manifesto de integridade dos bytes do pacote.
 * Não autentica remetente, não comprova entrega, não escreve no Core.
 * A origem do documento continua sendo consulta administrativa autorizada.
 */
import type { Ac02PreparedDistribution } from "./ac02-controlled-distribution.ts";

export type Ac02PackageManifest = Readonly<{
 kind:"nucleo_ac02_package_manifest";
 version:"1.0";
 packageId:string;
 packageVersion:"1.0";
 packageSha256:string;
 moduleCode:string;
 recipientKind:"sucessor_humano"|"novo_chat_ia";
 recipientAuthUid:string|null;
 preparedByAuthUid:string;
 preparedAt:string;
 byteLength:number;
 digestAlgorithm:"SHA-256";
 digestScope:"exact-utf8-document-bytes";
 provenance:"local_computed_not_authenticated";
 delivered:false;
 accepted:false;
}>;

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX=/^[0-9a-f]{64}$/;
const equals=(a:string,b:string)=>a.length===b.length&&a===b;

function assertPrepared(input:Ac02PreparedDistribution):void{
 if(input.kind!=="nucleo_ac02_repasse_preparado"||
    input.state!=="preparado_nao_enviado"||
    input.version!=="1.0"||input.receipt.recordedInCore!==false||
    input.receipt.delivered!==false||input.receipt.received!==false||
    input.receipt.mandateGranted!==false||
    !/^[A-Z]{3}$/.test(input.moduleCode)||
    !UUID.test(input.selectedByAuthUid)||
    (input.recipientAuthUid!==null&&!UUID.test(input.recipientAuthUid))||
    !input.document.startsWith("# PACOTE OFICIAL DE ASSUNÇÃO — RASCUNHO CONSULTIVO AC-02\n")||
    !input.document.includes("Status: NÃO HOMOLOGADO")||
    !input.document.includes("- Módulo: Módulo "+input.moduleCode+"\n"))
    throw new Error("AC02: pacote preparado não corresponde ao contrato");
}

/** Hash real do texto exato, sem reformatar quebras de linha ou caracteres. */
export async function sha256Ac02Text(
 text:string,
 cryptoProvider:Pick<Crypto,"subtle">=crypto,
):Promise<Readonly<{sha256:string;byteLength:number}>>{
 if(typeof text!=="string"||text.length<50||text.length>80_000)
  throw new Error("AC02: invalid document length");
 const bytes=new TextEncoder().encode(text);
 const hash=await cryptoProvider.subtle.digest("SHA-256",bytes);
 const sha256=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join("");
 if(!HEX.test(sha256))throw new Error("AC02: digest unavailable");
 return {sha256,byteLength:bytes.byteLength};
}

/**
 * Computa o hash real do documento, sem aceitar checksum informado pelo cliente.
 * packageId é um UUID gerado pelo controlador e NÃO identifica destinatário.
 */
export async function createAc02PackageManifest(
 prepared:Ac02PreparedDistribution,
 packageId:string,
 cryptoProvider:Pick<Crypto,"subtle">=crypto,
):Promise<Ac02PackageManifest>{
 assertPrepared(prepared);
 if(!UUID.test(packageId))throw new Error("AC02: package id invalid");
 const {sha256,byteLength}=await sha256Ac02Text(prepared.document,cryptoProvider);
 return Object.freeze({
  kind:"nucleo_ac02_package_manifest",version:"1.0",packageId,
  packageVersion:"1.0",packageSha256:sha256,
  moduleCode:prepared.moduleCode,recipientKind:prepared.recipientKind,
  recipientAuthUid:prepared.recipientAuthUid,
  preparedByAuthUid:prepared.selectedByAuthUid,preparedAt:prepared.selectedAt,
  byteLength,digestAlgorithm:"SHA-256",
  digestScope:"exact-utf8-document-bytes",
  provenance:"local_computed_not_authenticated",
  delivered:false,accepted:false,
 });
}

/** Detecta modificações após preparação; não valida sessão ou autoria. */
export async function verifyAc02PackageManifest(
 manifest:Ac02PackageManifest,
 document:string,
 cryptoProvider:Pick<Crypto,"subtle">=crypto,
):Promise<boolean>{
 if(manifest.kind!=="nucleo_ac02_package_manifest"||
    manifest.version!=="1.0"||
    manifest.packageVersion!=="1.0"||
    manifest.digestAlgorithm!=="SHA-256"||
    manifest.digestScope!=="exact-utf8-document-bytes"||
    manifest.provenance!=="local_computed_not_authenticated"||
    manifest.delivered!==false||manifest.accepted!==false||
    !UUID.test(manifest.packageId)||!HEX.test(manifest.packageSha256))
    return false;
 try{
  const {sha256,byteLength}=await sha256Ac02Text(document,cryptoProvider);
  return byteLength===manifest.byteLength&&equals(sha256,manifest.packageSha256);
 }catch{return false;}
}
