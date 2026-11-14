/**
 * AC-02 — contrato de distribuição controlada para o gestor.
 * NÃO faz envio, gravação, certificação, concessão de acesso ou auditoria persistida.
 * A versão do pacote é recebida do exportador AC-02 já autenticado.
 * Um comprovante de PREPARAÇÃO não deve ser confundido com entrega/recebimento.
 */
import type { Ac02AssumptionExport } from "./ac02-assumption-export.ts";

export type Ac02DeliveryTarget = Readonly<{
  moduleCode: string;
  recipientKind: "sucessor_humano" | "novo_chat_ia";
  // UUID é identidade escolhida pelo gestor, não é mandato validado.
  recipientAuthUid: string | null;
}>;

export type Ac02DistributionReview = Readonly<{
  selectedByAuthUid: string;
  selectedAt: string;
  target: Ac02DeliveryTarget;
  confirmedModule: boolean;
  confirmedNonSecret: boolean;
  confirmedMissingMandate: boolean;
  confirmedNoAccessTransfer: boolean;
  confirmedDraftStatus: boolean;
}>;

export type Ac02PreparedDistribution = Readonly<{
  kind: "nucleo_ac02_repasse_preparado";
  state: "preparado_nao_enviado";
  version: "1.0";
  moduleCode: string;
  recipientKind: Ac02DeliveryTarget["recipientKind"];
  recipientAuthUid: string | null;
  selectedByAuthUid: string;
  selectedAt: string;
  document: string;
  receipt: Readonly<{
    kind: "nucleo_ac02_recibo_preparacao_nao_persistido";
    recordedInCore: false;
    delivered: false;
    received: false;
    mandateGranted: false;
    notes: string;
  }>;
}>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const modulePattern = /^[A-Z]{3}$/;
const confirmed = (r: Ac02DistributionReview) =>
  r.confirmedModule && r.confirmedNonSecret && r.confirmedMissingMandate &&
  r.confirmedNoAccessTransfer && r.confirmedDraftStatus;

/** Preparação local somente; chamado APÓS o gestor ter revisado o texto. */
export function prepareAc02ControlledDistribution(
  draft: Ac02AssumptionExport,
  review: Ac02DistributionReview,
  nowIso: string,
): Ac02PreparedDistribution {
  if (draft.kind !== "nucleo_ac02_pacote_oficial_assuncao_rascunho" ||
      draft.status !== "rascunho_nao_homologado" || draft.privateSourcesIncluded !== false ||
      draft.version !== "1.0") throw new Error("AC02: invalid or unreviewed source");
  if (!confirmed(review)) throw new Error("AC02: manager confirmation incomplete");
  if (!modulePattern.test(review.target.moduleCode)) throw new Error("AC02: invalid module");
  // A base do pacote foi produzida com o código de módulo no exportador.
  if (!draft.text.includes("- Módulo: Módulo " + review.target.moduleCode + "\n"))
    throw new Error("AC02: source module mismatch");
  if (!uuidPattern.test(review.selectedByAuthUid)) throw new Error("AC02: invalid reviewer");
  if (review.target.recipientKind === "sucessor_humano" &&
      (!review.target.recipientAuthUid || !uuidPattern.test(review.target.recipientAuthUid)))
    throw new Error("AC02: human recipient must be selected explicitly");
  if (review.target.recipientKind === "novo_chat_ia" &&
      review.target.recipientAuthUid !== null)
    throw new Error("AC02: chat target may not impersonate Supabase identity");
  if (!datePattern.test(review.selectedAt) || !datePattern.test(nowIso) ||
      Number.isNaN(Date.parse(review.selectedAt)) || Number.isNaN(Date.parse(nowIso)) ||
      Date.parse(review.selectedAt) > Date.parse(nowIso) ||
      Date.parse(nowIso) - Date.parse(review.selectedAt) > 15 * 60 * 1000)
    throw new Error("AC02: review expired or invalid");
  if (draft.text.length > 80_000 || !draft.text.startsWith("# PACOTE OFICIAL DE ASSUNÇÃO — RASCUNHO CONSULTIVO AC-02\n") ||
      !draft.text.includes("Status: NÃO HOMOLOGADO") ||
      !draft.text.includes("Fontes privadas: não incluídas neste pacote"))
    throw new Error("AC02: unexpected document format");
  // Metadados identificadores não são adicionados ao documento exportado:
  // um humano/IA deve confirmar o destinatário na ferramenta de entrega.
  const receipt = Object.freeze({
    kind: "nucleo_ac02_recibo_preparacao_nao_persistido" as const,
    recordedInCore: false as const,
    delivered: false as const,
    received: false as const,
    mandateGranted: false as const,
    notes: "Comprovante transitório de seleção/revisão. Não prova envio, recebimento, aprovação, autenticidade da sessão ou registro no Core.",
  });
  return Object.freeze({
    kind: "nucleo_ac02_repasse_preparado" as const,
    state: "preparado_nao_enviado" as const,
    version: "1.0" as const,
    moduleCode: review.target.moduleCode,
    recipientKind: review.target.recipientKind,
    recipientAuthUid: review.target.recipientAuthUid,
    selectedByAuthUid: review.selectedByAuthUid,
    selectedAt: review.selectedAt,
    document: draft.text,
    receipt,
  });
}
