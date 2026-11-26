import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { captureReadiness } from "../cch/e5CaptureContracts";

const labels:Record<string,string>={
 versioned_m1_consent_constraint_and_policy_review:"Política e consentimento específico para revisão personalizada",
 approved_m4_session_review_payload_and_permission_contract:"Registro de recuperação por sessão, com autoria e permissões revisadas",
 authenticated_rls_homologation:"Validação do isolamento e das permissões de acesso",
 athlete_explicit_decision_and_current_goal:"Decisão explícita do atleta e objetivo atual",
 repeated_real_comparable_evidence:"Observações repetidas e comparáveis do treinamento"
};

/** Exposes the existing global gate, not an individual consent or clinical assessment. */
export function HealthPersonalizationReadiness(){
 const readiness=captureReadiness();
 return <Card data-testid="cch-u07-personalization-readiness">
  <CardHeader><CardTitle className="text-base">Evolução individual e personalização</CardTitle></CardHeader>
  <CardContent className="space-y-2 text-sm">
   <p className="font-medium">Revisão longitudinal personalizada ainda não habilitada</p>
   <p className="text-xs text-muted-foreground">Você pode continuar treinando, consultando seu histórico e revisando programas normalmente. A indisponibilidade desta etapa não altera seu nível de experiência ou sua prescrição.</p>
   <details className="rounded-lg border p-3">
    <summary className="cursor-pointer min-h-11 flex items-center font-medium">O que falta para habilitar esta etapa?</summary>
    <p className="text-xs text-muted-foreground mb-2">Requisitos gerais de implantação, não uma avaliação dos dados ou do consentimento deste atleta.</p>
    <ul className="list-disc pl-5 space-y-1">{readiness.outstanding.map(item=><li key={item} className="text-xs">{labels[item]??"Requisito de segurança a revisar"}</li>)}</ul>
   </details>
   <p className="text-xs text-muted-foreground">Nenhum consentimento é solicitado ou presumido aqui. Nenhum dado adicional é coletado, nenhuma carga é sugerida e nenhuma versão é publicada por esta consulta.</p>
  </CardContent>
 </Card>;
}
