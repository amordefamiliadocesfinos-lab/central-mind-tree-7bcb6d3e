import type { Database } from "@/integrations/supabase/types";

export type NucleoSourceReference = {
  id: string;
  provider: "google_drive";
  provider_file_id: string;
  source_name: string;
  source_mime_type: string;
  source_parent_id: string | null;
  source_modified_at: string | null;
  source_checksum_sha256: string | null;
  source_access_class: "nao_verificado" | "privado" | "restrito" | "publico_verificado";
  authority_state: "nao_classificado" | "historico" | "provisorio" | "pendente_homologacao" | "vigente_comprovado";
  reference_state: "inventariado" | "reconciliacao_pendente" | "validado_metadados" | "arquivado";
  provenance_note: string | null;
  content_imported: false;
  created_at: string;
  recorded_by_auth_uid: string | null;
};

type NucleoRefsTable = {
  Row: NucleoSourceReference;
  Insert: {
    provider: "google_drive";
    provider_file_id: string;
    source_name: string;
    source_mime_type: string;
    source_parent_id?: string | null;
    source_modified_at?: string | null;
    source_checksum_sha256?: string | null;
    source_access_class?: NucleoSourceReference["source_access_class"];
    authority_state?: NucleoSourceReference["authority_state"];
    reference_state?: NucleoSourceReference["reference_state"];
    provenance_note?: string | null;
  };
  Update: never;
  Relationships: [];
};

// Tipagem local até regeneração das definições oficiais do Supabase.
// Não altera migrations, dados e nem o cliente global.
export type NucleoRefsDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      nucleo_source_references: NucleoRefsTable;
    };
  };
};
