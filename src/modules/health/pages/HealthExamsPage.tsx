import { useMemo, useState } from "react";
import { FileText, FlaskConical, HeartPulse, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useHealthAthlete } from "../hooks/useHealthAthlete";
import { type BiomarkerInput, useHealthExamsM9 } from "../hooks/useHealthExamsM9";

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function HealthExamsPage() {
  const { toast } = useToast();
  const { athlete, loading: athleteLoading } = useHealthAthlete();
  const exams = useHealthExamsM9(athlete?.id);

  const [file, setFile] = useState<File | null>(null);
  const [provider, setProvider] = useState("");
  const [documentDate, setDocumentDate] = useState("");

  const [labName, setLabName] = useState("");
  const [collectedAt, setCollectedAt] = useState("");
  const [fastingStatus, setFastingStatus] = useState("unknown");
  const [reportNotes, setReportNotes] = useState("");
  const [biomarkers, setBiomarkers] = useState<BiomarkerInput[]>([{
    original_analyte_name: "",
    original_result_text: "",
    numeric_value: null,
    original_unit: "",
    original_reference_text: "",
    original_flag: "",
  }]);

  const [vitalMetric, setVitalMetric] = useState("blood_pressure");
  const [vitalValue, setVitalValue] = useState("");
  const [vitalSecondary, setVitalSecondary] = useState("");
  const [vitalUnit, setVitalUnit] = useState("mmHg");
  const [vitalContext, setVitalContext] = useState("");

  const activeDocuments = useMemo(() => exams.documents.filter((item) => item.status === "active"), [exams.documents]);
  const activeReports = useMemo(() => exams.reports.filter((item) => item.status === "active"), [exams.reports]);

  const upload = async () => {
    if (!file) return;
    try {
      await exams.uploadDocument(file, {
        documentType: "laboratory_report",
        documentDate: documentDate || null,
        providerName: provider || null,
      });
      toast({ title: "Documento privado salvo", description: "O arquivo foi registrado sem transformá-lo automaticamente em dado clínico confirmado." });
      setFile(null);
      setProvider("");
      setDocumentDate("");
    } catch (cause) {
      toast({ variant: "destructive", title: "Não foi possível enviar", description: cause instanceof Error ? cause.message : "Tente novamente." });
    }
  };

  const saveReport = async () => {
    const rows = biomarkers.filter((item) => item.original_analyte_name.trim() && item.original_result_text.trim());
    try {
      await exams.recordLabReport({
        laboratoryName: labName || null,
        collectedAt: collectedAt || null,
        fastingStatus: fastingStatus === "unknown" ? null : fastingStatus,
        notes: reportNotes || null,
        biomarkers: rows,
      });
      toast({ title: "Exame registrado", description: "Valor, unidade e referência originais foram preservados." });
      setBiomarkers([{ original_analyte_name: "", original_result_text: "", numeric_value: null, original_unit: "", original_reference_text: "", original_flag: "" }]);
      setReportNotes("");
    } catch (cause) {
      toast({ variant: "destructive", title: "Não foi possível registrar", description: cause instanceof Error ? cause.message : "Tente novamente." });
    }
  };

  const saveVital = async () => {
    const numericValue = numberOrNull(vitalValue);
    if (numericValue == null) return;
    try {
      await exams.recordVital({
        metricCode: vitalMetric,
        numericValue,
        secondaryNumericValue: numberOrNull(vitalSecondary),
        unitCode: vitalUnit,
        conditionText: vitalContext,
      });
      toast({ title: "Sinal fisiológico registrado" });
      setVitalValue("");
      setVitalSecondary("");
    } catch (cause) {
      toast({ variant: "destructive", title: "Não foi possível registrar", description: cause instanceof Error ? cause.message : "Tente novamente." });
    }
  };

  if (athleteLoading || exams.loading) {
    return <div className="flex min-h-56 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Exames e biomarcadores</h2>
          <p className="mt-1 text-sm text-muted-foreground">Resultados, documentos e histórico. Estrutura não é diagnóstico.</p>
        </div>
        <Button size="sm" variant="outline" className="min-h-10 shrink-0" disabled={exams.saving} onClick={() => void exams.reload()}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
      </div>

      {exams.error ? <Card className="border-destructive/40"><CardContent className="py-3 text-sm text-destructive">{exams.error}</CardContent></Card> : null}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Upload className="h-4 w-4 text-primary" /> Documento privado</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="clinical-file">PDF ou imagem</Label><Input id="clinical-file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="min-h-11" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></div>
            <div className="space-y-2"><Label>Data do documento</Label><Input type="date" className="min-h-11" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Laboratório / prestador</Label><Input className="min-h-11" value={provider} onChange={(event) => setProvider(event.target.value)} /></div>
          <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">O arquivo fica no bucket privado. Upload não significa resultado confirmado; extração futura passa por revisão antes de virar fato canônico.</div>
          <Button className="min-h-11 w-full" disabled={!file || exams.saving} onClick={() => void upload()}>{exams.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Salvar documento privado</Button>

          {activeDocuments.length ? <div className="space-y-2 border-t pt-4">{activeDocuments.map((document) => (
            <div key={document.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{document.original_filename}</p><p className="text-xs text-muted-foreground">{document.provider_name ?? "Prestador desconhecido"} · {document.document_date ?? "Data desconhecida"}</p></div>
              <div className="flex gap-1">
                {document.signed_url ? <Button asChild size="sm" variant="outline" className="min-h-10"><a href={document.signed_url} target="_blank" rel="noreferrer">Abrir</a></Button> : null}
                <Button size="icon" variant="ghost" className="min-h-11 min-w-11" onClick={() => void exams.voidDocument(document.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><FlaskConical className="h-4 w-4 text-primary" /> Registrar exame manualmente</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2"><Label>Laboratório</Label><Input className="min-h-11" value={labName} onChange={(e) => setLabName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Coleta</Label><Input type="datetime-local" className="min-h-11" value={collectedAt} onChange={(e) => setCollectedAt(e.target.value)} /></div>
            <div className="space-y-2"><Label>Jejum</Label><Select value={fastingStatus} onValueChange={setFastingStatus}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Desconhecido</SelectItem><SelectItem value="fasting">Sim</SelectItem><SelectItem value="non_fasting">Não</SelectItem></SelectContent></Select></div>
          </div>

          <div className="space-y-3">
            {biomarkers.map((item, index) => (
              <div key={index} className="rounded-xl border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Marcador original</Label><Input className="min-h-11" value={item.original_analyte_name} onChange={(e) => setBiomarkers((rows) => rows.map((row, i) => i === index ? { ...row, original_analyte_name: e.target.value } : row))} /></div>
                  <div className="space-y-2"><Label>Resultado original</Label><Input className="min-h-11" value={item.original_result_text} onChange={(e) => setBiomarkers((rows) => rows.map((row, i) => i === index ? { ...row, original_result_text: e.target.value, numeric_value: numberOrNull(e.target.value) } : row))} /></div>
                  <div className="space-y-2"><Label>Unidade original</Label><Input className="min-h-11" value={item.original_unit ?? ""} onChange={(e) => setBiomarkers((rows) => rows.map((row, i) => i === index ? { ...row, original_unit: e.target.value } : row))} /></div>
                  <div className="space-y-2"><Label>Referência original</Label><Input className="min-h-11" value={item.original_reference_text ?? ""} onChange={(e) => setBiomarkers((rows) => rows.map((row, i) => i === index ? { ...row, original_reference_text: e.target.value } : row))} /></div>
                  <div className="space-y-2 sm:col-span-2"><Label>Flag original do laboratório</Label><Input className="min-h-11" value={item.original_flag ?? ""} onChange={(e) => setBiomarkers((rows) => rows.map((row, i) => i === index ? { ...row, original_flag: e.target.value } : row))} /></div>
                </div>
                {biomarkers.length > 1 ? <Button variant="ghost" size="sm" className="mt-2 min-h-10" onClick={() => setBiomarkers((rows) => rows.filter((_, i) => i !== index))}>Remover linha</Button> : null}
              </div>
            ))}
          </div>
          <Button variant="outline" className="min-h-11 w-full" onClick={() => setBiomarkers((rows) => [...rows, { original_analyte_name: "", original_result_text: "", numeric_value: null, original_unit: "", original_reference_text: "", original_flag: "" }])}>Adicionar marcador</Button>
          <Textarea placeholder="Observações do exame" value={reportNotes} onChange={(e) => setReportNotes(e.target.value)} />
          <Button className="min-h-11 w-full" disabled={exams.saving || !biomarkers.some((item) => item.original_analyte_name.trim() && item.original_result_text.trim())} onClick={() => void saveReport()}>Salvar exame confirmado</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><HeartPulse className="h-4 w-4 text-primary" /> Sinal fisiológico</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-2"><Label>Métrica</Label><Select value={vitalMetric} onValueChange={(value) => { setVitalMetric(value); if (value === "blood_pressure") setVitalUnit("mmHg"); }}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="blood_pressure">Pressão arterial</SelectItem><SelectItem value="resting_heart_rate">Frequência cardíaca</SelectItem><SelectItem value="temperature">Temperatura</SelectItem><SelectItem value="oxygen_saturation">Saturação</SelectItem><SelectItem value="respiratory_rate">Frequência respiratória</SelectItem><SelectItem value="blood_glucose">Glicemia</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>{vitalMetric === "blood_pressure" ? "Sistólica" : "Valor"}</Label><Input inputMode="decimal" className="min-h-11" value={vitalValue} onChange={(e) => setVitalValue(e.target.value)} /></div>
            {vitalMetric === "blood_pressure" ? <div className="space-y-2"><Label>Diastólica</Label><Input inputMode="decimal" className="min-h-11" value={vitalSecondary} onChange={(e) => setVitalSecondary(e.target.value)} /></div> : null}
            <div className="space-y-2"><Label>Unidade</Label><Input className="min-h-11" value={vitalUnit} onChange={(e) => setVitalUnit(e.target.value)} /></div>
          </div>
          <Input className="min-h-11" placeholder="Condição/contexto opcional" value={vitalContext} onChange={(e) => setVitalContext(e.target.value)} />
          <Button className="min-h-11 w-full" disabled={exams.saving || numberOrNull(vitalValue) == null} onClick={() => void saveVital()}>Registrar sinal</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" /> Histórico de exames</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {activeReports.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum exame confirmado.</p> : activeReports.map((report) => (
            <div key={report.id} className="rounded-xl border p-3">
              <p className="text-sm font-medium">{report.laboratory_name ?? "Laboratório não informado"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{report.collected_at ? new Date(report.collected_at).toLocaleString("pt-BR") : "Coleta desconhecida"}</p>
              <div className="mt-3 space-y-2">
                {exams.reportResults(report.id).map((result) => (
                  <div key={result.id} className="rounded-lg bg-muted/40 p-2.5 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2"><strong>{result.original_analyte_name}</strong><span>{result.original_result_text}{result.original_unit ? ` ${result.original_unit}` : ""}</span></div>
                    <p className="mt-1 text-xs text-muted-foreground">Referência: {result.original_reference_text || "Desconhecida"}{result.original_flag ? ` · Flag original: ${result.original_flag}` : ""}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="px-1 text-xs text-muted-foreground">Resultados estruturados não são diagnóstico. Mudanças clínicas continuam pertencendo à avaliação profissional apropriada.</p>
    </div>
  );
}
