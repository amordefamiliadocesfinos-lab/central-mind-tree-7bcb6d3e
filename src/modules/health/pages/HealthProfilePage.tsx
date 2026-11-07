import { useEffect, useMemo, useState } from "react";
import {
  Dumbbell,
  Loader2,
  MapPin,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useHealthAthlete } from "../hooks/useHealthAthlete";
import {
  ConsentType,
  useHealthProfileM1,
} from "../hooks/useHealthProfileM1";

const consentLabels: Array<{ type: ConsentType; title: string; description: string }> = [
  {
    type: "health_data_processing",
    title: "Dados do módulo Saúde",
    description: "Autoriza registrar e usar seus dados dentro das funções do módulo Saúde.",
  },
  {
    type: "private_media_storage",
    title: "Mídia privada",
    description: "Autoriza armazenar fotos e vídeos futuros no bucket privado do atleta.",
  },
  {
    type: "media_analysis",
    title: "Análise de mídia",
    description: "Autoriza análises técnicas futuras de fotos e vídeos enviados pelo atleta.",
  },
  {
    type: "coach_sharing",
    title: "Compartilhamento com profissional",
    description: "Registra sua decisão sobre compartilhamento explícito com coach/profissional.",
  },
  {
    type: "notifications",
    title: "Notificações",
    description: "Autoriza lembretes e notificações do módulo Saúde.",
  },
];

function nullableNumber(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof UserRound;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function HealthProfilePage() {
  const { toast } = useToast();
  const { athlete, loading: athleteLoading } = useHealthAthlete();
  const m1 = useHealthProfileM1(athlete?.id);

  const [birthDate, setBirthDate] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [experience, setExperience] = useState("");
  const [dominantSide, setDominantSide] = useState("");
  const [profileNotes, setProfileNotes] = useState("");

  const [goalType, setGoalType] = useState("hypertrophy");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalPriority, setGoalPriority] = useState("1");
  const [goalNotes, setGoalNotes] = useState("");

  const [phaseType, setPhaseType] = useState("build");
  const [phaseTitle, setPhaseTitle] = useState("");
  const [phaseNotes, setPhaseNotes] = useState("");

  const [locationName, setLocationName] = useState("");
  const [locationType, setLocationType] = useState("gym");
  const [locationNotes, setLocationNotes] = useState("");
  const [equipmentName, setEquipmentName] = useState("");
  const [equipmentCategory, setEquipmentCategory] = useState("");

  const [sessionMinutes, setSessionMinutes] = useState("");
  const [sessionsPerWeek, setSessionsPerWeek] = useState("");
  const [trainingTime, setTrainingTime] = useState("");
  const [preferencesNotes, setPreferencesNotes] = useState("");

  useEffect(() => {
    setBirthDate(m1.profile?.date_of_birth ?? "");
    setHeightCm(m1.profile?.height_cm?.toString() ?? "");
    setExperience(m1.profile?.training_experience_level ?? "");
    setDominantSide(m1.profile?.dominant_side ?? "");
    setProfileNotes(m1.profile?.profile_notes ?? "");
  }, [m1.profile]);

  useEffect(() => {
    setGoalType(m1.activeGoal?.goal_type ?? "hypertrophy");
    setGoalTitle(m1.activeGoal?.title ?? "");
    setGoalPriority(m1.activeGoal?.priority?.toString() ?? "1");
    setGoalNotes(m1.activeGoal?.notes ?? "");
  }, [m1.activeGoal]);

  useEffect(() => {
    setPhaseType(m1.activePhase?.phase_type ?? "build");
    setPhaseTitle(m1.activePhase?.title ?? "");
    setPhaseNotes(m1.activePhase?.objective_notes ?? "");
  }, [m1.activePhase]);

  useEffect(() => {
    setLocationName(m1.primaryLocation?.name ?? "");
    setLocationType(m1.primaryLocation?.location_type ?? "gym");
    setLocationNotes(m1.primaryLocation?.notes ?? "");
  }, [m1.primaryLocation]);

  useEffect(() => {
    setSessionMinutes(m1.preferences?.preferred_session_minutes?.toString() ?? "");
    setSessionsPerWeek(m1.preferences?.preferred_sessions_per_week?.toString() ?? "");
    setTrainingTime(m1.preferences?.training_time_preference ?? "");
    setPreferencesNotes(m1.preferences?.notes ?? "");
  }, [m1.preferences]);

  const completion = useMemo(() => {
    const sections = [
      Boolean(m1.profile),
      Boolean(m1.activeGoal),
      Boolean(m1.primaryLocation),
      Boolean(m1.preferences),
      Boolean(m1.latestConsents.health_data_processing),
    ];
    return Math.round((sections.filter(Boolean).length / sections.length) * 100);
  }, [m1.activeGoal, m1.latestConsents.health_data_processing, m1.preferences, m1.primaryLocation, m1.profile]);

  const saveWithToast = async (label: string, action: () => Promise<void>) => {
    try {
      await action();
      toast({ title: "Salvo", description: label });
    } catch (cause) {
      toast({
        variant: "destructive",
        title: "Não foi possível salvar",
        description: cause instanceof Error ? cause.message : "Tente novamente.",
      });
    }
  };

  if (athleteLoading || m1.loading) {
    return (
      <div className="flex min-h-56 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Perfil</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Identidade física, objetivos e contexto de treino do atleta.
          </p>
        </div>
        <div className="shrink-0 rounded-full border px-3 py-1 text-xs font-medium">
          {completion}% base
        </div>
      </div>

      {m1.error ? (
        <Card className="border-destructive/40">
          <CardContent className="py-3 text-sm text-destructive">{m1.error}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <SectionTitle
            icon={UserRound}
            title="Perfil básico"
            description="Dados relativamente estáveis. Peso e fotos ficam na área Evolução."
          />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="health-birth-date">Data de nascimento</Label>
            <Input
              id="health-birth-date"
              type="date"
              className="min-h-11"
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="health-height">Altura (cm)</Label>
            <Input
              id="health-height"
              inputMode="decimal"
              className="min-h-11"
              placeholder="Ex.: 180"
              value={heightCm}
              onChange={(event) => setHeightCm(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Experiência de treino</Label>
            <Select value={experience || "unknown"} onValueChange={setExperience}>
              <SelectTrigger className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Ainda não informado</SelectItem>
                <SelectItem value="beginner">Iniciante</SelectItem>
                <SelectItem value="intermediate">Intermediário</SelectItem>
                <SelectItem value="advanced">Avançado</SelectItem>
                <SelectItem value="returning">Retornando</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Lado dominante</Label>
            <Select value={dominantSide || "unknown"} onValueChange={setDominantSide}>
              <SelectTrigger className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Ainda não informado</SelectItem>
                <SelectItem value="right">Direito</SelectItem>
                <SelectItem value="left">Esquerdo</SelectItem>
                <SelectItem value="mixed">Misto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="health-profile-notes">Observações</Label>
            <Textarea
              id="health-profile-notes"
              value={profileNotes}
              onChange={(event) => setProfileNotes(event.target.value)}
              placeholder="Informações gerais úteis para o planejamento."
            />
          </div>
          <Button
            className="min-h-11 sm:col-span-2"
            disabled={m1.saving}
            onClick={() =>
              void saveWithToast("Perfil básico atualizado.", () =>
                m1.saveProfile({
                  date_of_birth: birthDate || null,
                  height_cm: nullableNumber(heightCm),
                  training_experience_level: experience || null,
                  dominant_side: dominantSide || null,
                  profile_notes: profileNotes.trim() || null,
                }),
              )
            }
          >
            {m1.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar perfil
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <SectionTitle
            icon={Target}
            title="Objetivo e fase atual"
            description="O objetivo orienta o sistema; a fase descreve o momento atual dentro dele."
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Objetivo</Label>
              <Select value={goalType} onValueChange={setGoalType}>
                <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hypertrophy">Hipertrofia</SelectItem>
                  <SelectItem value="strength">Força</SelectItem>
                  <SelectItem value="fat_loss">Perda de gordura</SelectItem>
                  <SelectItem value="recomposition">Recomposição</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                  <SelectItem value="health">Saúde geral</SelectItem>
                  <SelectItem value="maintenance">Manutenção</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={goalPriority} onValueChange={setGoalPriority}>
                <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 — Principal</SelectItem>
                  <SelectItem value="2">2 — Alta</SelectItem>
                  <SelectItem value="3">3 — Média</SelectItem>
                  <SelectItem value="4">4 — Baixa</SelectItem>
                  <SelectItem value="5">5 — Complementar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="health-goal-title">Nome do objetivo</Label>
            <Input
              id="health-goal-title"
              className="min-h-11"
              placeholder="Ex.: Ganho de massa muscular"
              value={goalTitle}
              onChange={(event) => setGoalTitle(event.target.value)}
            />
          </div>
          <Textarea
            value={goalNotes}
            onChange={(event) => setGoalNotes(event.target.value)}
            placeholder="Detalhes do objetivo, sem transformar observações em fatos medidos."
          />
          <Button
            variant="secondary"
            className="min-h-11 w-full"
            disabled={m1.saving || goalTitle.trim().length < 2}
            onClick={() =>
              void saveWithToast("Objetivo principal atualizado.", () =>
                m1.saveGoal({
                  goal_type: goalType,
                  title: goalTitle.trim(),
                  priority: Number(goalPriority),
                  notes: goalNotes.trim() || null,
                }),
              )
            }
          >
            Salvar objetivo
          </Button>

          <div className="border-t pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Fase atual</Label>
                <Select value={phaseType} onValueChange={setPhaseType}>
                  <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="build">Construção</SelectItem>
                    <SelectItem value="cut">Déficit / corte</SelectItem>
                    <SelectItem value="recomp">Recomposição</SelectItem>
                    <SelectItem value="maintenance">Manutenção</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="reentry">Retorno</SelectItem>
                    <SelectItem value="custom">Personalizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="health-phase-title">Nome da fase</Label>
                <Input
                  id="health-phase-title"
                  className="min-h-11"
                  placeholder="Ex.: Bloco inicial"
                  value={phaseTitle}
                  onChange={(event) => setPhaseTitle(event.target.value)}
                />
              </div>
            </div>
            <Textarea
              className="mt-4"
              value={phaseNotes}
              onChange={(event) => setPhaseNotes(event.target.value)}
              placeholder="O que esta fase pretende desenvolver."
            />
            <Button
              variant="outline"
              className="mt-4 min-h-11 w-full"
              disabled={m1.saving || !m1.activeGoal || phaseTitle.trim().length < 2}
              onClick={() =>
                void saveWithToast("Fase atualizada.", () =>
                  m1.savePhase({
                    phase_type: phaseType,
                    title: phaseTitle.trim(),
                    objective_notes: phaseNotes.trim() || null,
                  }),
                )
              }
            >
              Salvar fase
            </Button>
            {!m1.activeGoal ? (
              <p className="mt-2 text-xs text-muted-foreground">Salve primeiro o objetivo principal.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <SectionTitle
            icon={MapPin}
            title="Local e equipamentos"
            description="Contexto real disponível para o treino. O catálogo universal será normalizado na M2."
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="health-location-name">Local principal</Label>
              <Input
                id="health-location-name"
                className="min-h-11"
                placeholder="Ex.: Academia principal"
                value={locationName}
                onChange={(event) => setLocationName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={locationType} onValueChange={setLocationType}>
                <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gym">Academia</SelectItem>
                  <SelectItem value="home">Casa</SelectItem>
                  <SelectItem value="outdoor">Ao ar livre</SelectItem>
                  <SelectItem value="travel">Viagem</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Textarea
            value={locationNotes}
            onChange={(event) => setLocationNotes(event.target.value)}
            placeholder="Limitações ou características relevantes do local."
          />
          <Button
            variant="secondary"
            className="min-h-11 w-full"
            disabled={m1.saving || locationName.trim().length < 2}
            onClick={() =>
              void saveWithToast("Local principal atualizado.", () =>
                m1.savePrimaryLocation({
                  name: locationName.trim(),
                  location_type: locationType,
                  notes: locationNotes.trim() || null,
                }),
              )
            }
          >
            Salvar local
          </Button>

          <div className="border-t pt-4">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Equipamentos declarados</p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_160px_auto]">
              <Input
                className="min-h-11"
                placeholder="Ex.: Leg press 45°"
                value={equipmentName}
                onChange={(event) => setEquipmentName(event.target.value)}
              />
              <Input
                className="min-h-11"
                placeholder="Categoria"
                value={equipmentCategory}
                onChange={(event) => setEquipmentCategory(event.target.value)}
              />
              <Button
                className="min-h-11"
                disabled={m1.saving || equipmentName.trim().length < 2}
                onClick={() =>
                  void saveWithToast("Equipamento adicionado.", async () => {
                    await m1.addEquipment(equipmentName.trim(), equipmentCategory.trim() || null);
                    setEquipmentName("");
                    setEquipmentCategory("");
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {m1.equipment.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum equipamento declarado ainda.</p>
              ) : (
                m1.equipment.map((item) => (
                  <div key={item.id} className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.display_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.category || "Sem categoria"} · {item.availability === "available" ? "Disponível" : "Indisponível/limitado"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="min-h-11 shrink-0"
                      onClick={() =>
                        void saveWithToast(
                          item.availability === "available" ? "Equipamento marcado como indisponível." : "Equipamento marcado como disponível.",
                          () =>
                            m1.setEquipmentAvailability(
                              item.id,
                              item.availability === "available" ? "unavailable" : "available",
                            ),
                        )
                      }
                    >
                      {item.availability === "available" ? "Pausar" : "Ativar"}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <SectionTitle
            icon={SlidersHorizontal}
            title="Preferências"
            description="Preferências orientam a recomendação, mas não vencem segurança ou recuperação."
          />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="health-session-minutes">Duração preferida (min)</Label>
            <Input
              id="health-session-minutes"
              type="number"
              min={15}
              max={240}
              className="min-h-11"
              value={sessionMinutes}
              onChange={(event) => setSessionMinutes(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="health-sessions-week">Sessões por semana</Label>
            <Input
              id="health-sessions-week"
              type="number"
              min={1}
              max={14}
              className="min-h-11"
              value={sessionsPerWeek}
              onChange={(event) => setSessionsPerWeek(event.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Horário preferido</Label>
            <Select value={trainingTime || "variable"} onValueChange={setTrainingTime}>
              <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">Manhã</SelectItem>
                <SelectItem value="afternoon">Tarde</SelectItem>
                <SelectItem value="evening">Noite</SelectItem>
                <SelectItem value="variable">Variável</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Observações</Label>
            <Textarea
              value={preferencesNotes}
              onChange={(event) => setPreferencesNotes(event.target.value)}
              placeholder="Preferências de rotina ou contexto."
            />
          </div>
          <Button
            className="min-h-11 sm:col-span-2"
            disabled={m1.saving}
            onClick={() =>
              void saveWithToast("Preferências atualizadas.", () =>
                m1.savePreferences({
                  preferred_session_minutes: nullableNumber(sessionMinutes),
                  preferred_sessions_per_week: nullableNumber(sessionsPerWeek),
                  training_time_preference: trainingTime || null,
                  notes: preferencesNotes.trim() || null,
                }),
              )
            }
          >
            Salvar preferências
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <SectionTitle
            icon={ShieldCheck}
            title="Consentimentos"
            description="Cada mudança gera um novo evento; o histórico anterior não é sobrescrito."
          />
        </CardHeader>
        <CardContent className="space-y-3">
          {consentLabels.map((item) => {
            const latest = m1.latestConsents[item.type];
            const granted = latest?.decision === "granted";
            return (
              <div key={item.type} className="flex min-h-14 items-center justify-between gap-4 rounded-xl border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {latest ? `Última decisão: ${latest.decision === "granted" ? "concedido" : latest.decision === "revoked" ? "revogado" : "negado"}` : "Sem decisão registrada"}
                  </p>
                </div>
                <div className="flex min-h-11 min-w-11 shrink-0 items-center justify-center">
                  <Switch
                    checked={granted}
                    disabled={m1.saving}
                    aria-label={item.title}
                    onCheckedChange={(checked) =>
                      void saveWithToast(
                        checked ? "Consentimento concedido." : "Consentimento revogado.",
                        () => m1.recordConsent(item.type, checked ? "granted" : latest ? "revoked" : "denied"),
                      )
                    }
                  />
                </div>
              </div>
            );
          })}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Estes registros representam decisões do usuário dentro do produto; requisitos jurídicos e textos finais de política serão revisados antes do Release Candidate.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
