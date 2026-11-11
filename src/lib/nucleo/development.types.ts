import type { Database } from "@/integrations/supabase/types";

export type DevelopmentKind = "modulo" | "frente" | "subfrente";
export type DevelopmentStatus = "planejado" | "em_andamento" | "bloqueado" | "em_validacao" | "concluido";
export type EvidenceState = "sem_evidencia" | "relatada" | "comprovada";
export type Priority = "baixa" | "normal" | "alta" | "critica";

export type DevelopmentWorkstream = {
  id: string;
  code: string;
  parent_id: string | null;
  title: string;
  description: string;
  kind: DevelopmentKind;
  status: DevelopmentStatus;
  priority: Priority;
  specialist: string;
  next_action: string;
  acceptance_criteria: string;
  blocker: string;
  evidence_state: EvidenceState;
  evidence_note: string;
  created_at: string;
  updated_at: string;
  created_by_auth_uid: string | null;
  updated_by_auth_uid: string | null;
};

export type DevelopmentEvent = {
  id: string;
  workstream_id: string;
  event_type: "criado" | "alterado";
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown>;
  actor_auth_uid: string | null;
  recorded_at: string;
};
export type DevelopmentDependency = {
  id: string;
  workstream_id: string;
  depends_on_id: string;
  description: string;
  created_at: string;
  created_by_auth_uid: string | null;
};

type WorkstreamTable = {
  Row: DevelopmentWorkstream;
  Insert: Partial<DevelopmentWorkstream> & Pick<DevelopmentWorkstream, "code" | "kind" | "title">;
  Update: Partial<DevelopmentWorkstream>;
  Relationships: [];
};
type EventTable = { Row: DevelopmentEvent; Insert: never; Update: never; Relationships: [] };
type DependencyTable = {
  Row: DevelopmentDependency;
  Insert: Pick<DevelopmentDependency, "workstream_id" | "depends_on_id"> & { description?: string };
  Update: never;
  Relationships: [];
};

export type NucleoDevelopmentDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      nucleo_development_workstreams: WorkstreamTable;
      nucleo_development_events: EventTable;
      nucleo_development_dependencies: DependencyTable;
    };
  };
};
