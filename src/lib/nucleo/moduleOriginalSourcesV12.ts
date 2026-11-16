/**
 * Entrega A+ FM-07/08 — referências ORIGINAIS identificadas nos acervos.
 * Não é importação Entrega B, nem prova de vigência ou disponibilidade no navegador.
 * Somente metadados; o operador precisa da fonte sob seu acesso.
 */
import { CRM_AUTHORITY_SOURCES_V12 } from "./crmAuthoritySourcesV12";

export type OriginalKnowledgeSource = Readonly<{
 id:string; title:string;version:string;archive:string;originalFile:string;
 sourceStatus:string;authorityScope:string;reconciliation:string;
}>;
export const MODULE_ORIGINAL_SOURCES_V12:Readonly<Partial<Record<string,ReadonlyArray<OriginalKnowledgeSource>>>>={
 CRM:CRM_AUTHORITY_SOURCES_V12,
};
