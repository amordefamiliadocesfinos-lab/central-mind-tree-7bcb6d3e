import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { localDateIso } from "../dashboard/dashboardModel";

type LooseTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type LooseDatabase = {
  public: {
    Tables: Record<string, LooseTable>;
    Views: Record<string, never>;
    Functions: {
      health_f16_save_reminder_rule: {
        Args: {
          p_athlete_id: string;
          p_reminder_type: string;
          p_label: string | null;
          p_enabled: boolean;
          p_schedule_kind: string;
          p_days_of_week: number[];
          p_local_time: string;
          p_interval_days: number | null;
          p_start_on: string;
          p_timezone: string;
          p_rule_id?: string | null;
        };
        Returns: string;
      };
      health_f16_archive_reminder_rule: {
        Args: { p_rule_id: string };
        Returns: string;
      };
      health_f16_record_reminder_event: {
        Args: {
          p_rule_id: string;
          p_event_type: string;
          p_event_date: string;
          p_notes?: string | null;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const db = supabase as unknown as SupabaseClient<LooseDatabase>;

export type ReminderType =
  | "training"
  | "nutrition_log"
  | "body_assessment"
  | "recovery_checkin"
  | "longitudinal_review";

export type ReminderScheduleKind = "daily" | "weekly" | "interval";

export type ReminderRule = {
  id: string;
  reminderType: ReminderType;
  label: string | null;
  enabled: boolean;
  scheduleKind: ReminderScheduleKind;
  daysOfWeek: number[];
  localTime: string;
  intervalDays: number | null;
  startOn: string;
  timezone: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type ReminderEvent = {
  id: string;
  ruleId: string;
  eventType: "completed" | "dismissed";
  eventDate: string;
  notes: string | null;
  occurredAt: string;
};

export type SaveReminderRuleInput = {
  ruleId?: string | null;
  reminderType: ReminderType;
  label?: string | null;
  enabled: boolean;
  scheduleKind: ReminderScheduleKind;
  daysOfWeek: number[];
  localTime: string;
  intervalDays?: number | null;
  startOn: string;
  timezone: string;
};

function isBackendUnavailable(
  error: { message?: string; code?: string } | null | undefined,
) {
  if (!error) return false;
  const message = error.message ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    (
      /health_(reminder|f16_)/i.test(message) &&
      /(does not exist|schema cache|could not find)/i.test(message)
    )
  );
}

function dateMinusDaysIso(days: number) {
  const base = new Date();
  const shifted = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() - days,
    12,
    0,
    0,
    0,
  );
  const year = shifted.getFullYear();
  const month = String(shifted.getMonth() + 1).padStart(2, "0");
  const day = String(shifted.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mapRule(value: unknown): ReminderRule {
  const row = value as {
    id: string;
    reminder_type: ReminderType;
    label: string | null;
    enabled: boolean;
    schedule_kind: ReminderScheduleKind;
    days_of_week: number[];
    local_time: string;
    interval_days: number | null;
    start_on: string;
    timezone: string;
    status: "active" | "archived";
    created_at: string;
    updated_at: string;
  };
  return {
    id: row.id,
    reminderType: row.reminder_type,
    label: row.label,
    enabled: row.enabled,
    scheduleKind: row.schedule_kind,
    daysOfWeek: row.days_of_week ?? [],
    localTime: row.local_time,
    intervalDays: row.interval_days,
    startOn: row.start_on,
    timezone: row.timezone,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvent(value: unknown): ReminderEvent {
  const row = value as {
    id: string;
    reminder_rule_id: string;
    event_type: ReminderEvent["eventType"];
    event_date: string;
    notes: string | null;
    occurred_at: string;
  };
  return {
    id: row.id,
    ruleId: row.reminder_rule_id,
    eventType: row.event_type,
    eventDate: row.event_date,
    notes: row.notes,
    occurredAt: row.occurred_at,
  };
}

export function reminderTypeLabel(value: ReminderType | string) {
  const labels: Record<string, string> = {
    training: "Treino",
    nutrition_log: "Diário alimentar",
    body_assessment: "Avaliação corporal",
    recovery_checkin: "Recuperação",
    longitudinal_review: "Revisão longitudinal",
  };
  return labels[value] ?? value;
}

export function reminderScheduleLabel(rule: ReminderRule) {
  if (rule.scheduleKind === "daily") {
    return `Todos os dias às ${rule.localTime.slice(0, 5)}`;
  }
  if (rule.scheduleKind === "interval") {
    return `A cada ${rule.intervalDays ?? "?"} dias às ${rule.localTime.slice(0, 5)}`;
  }
  const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return `${rule.daysOfWeek.map((day) => dayLabels[day] ?? day).join(", ")} às ${rule.localTime.slice(0, 5)}`;
}

export function useHealthRemindersF16(
  athleteId: string | null | undefined,
) {
  const scope=athleteId??null;
  const empty={rules:[] as ReminderRule[],events:[] as ReminderEvent[],backendAvailable:true,error:null as string|null};
  const [snapshot,setSnapshot]=useState({scope:null as string|null,...empty,loading:false});
  const [action,setAction]=useState({scope:null as string|null,saving:false,error:null as string|null});
  const request=useRef(0),epoch=useRef(0),locked=useRef(false);
  const activeScope=useRef<string|null|undefined>(undefined);
  const visible=snapshot.scope===scope?snapshot:{...empty,loading:Boolean(scope)};
  const currentAction=action.scope===scope?action:{saving:false,error:null};
  const readSnapshot=useCallback(async()=>{
    if(activeScope.current!==scope)return;
    const token=++request.current;
    const finish=(value:typeof empty)=>{
      if(token!==request.current)return undefined;
      setSnapshot({scope,...value,loading:false});
      return value;
    };
    if(!athleteId)return finish(empty);
    setSnapshot({scope,...empty,loading:true});
    try {
      const [rulesResult,eventsResult]=await Promise.all([
        db.from("health_reminder_rules").select("id,reminder_type,label,enabled,schedule_kind,days_of_week,local_time,interval_days,start_on,timezone,status,created_at,updated_at",{count:"exact"}).eq("athlete_id",athleteId).eq("status","active").order("local_time",{ascending:true}).order("created_at",{ascending:true}),
        db.from("health_reminder_events").select("id,reminder_rule_id,event_type,event_date,notes,occurred_at",{count:"exact"}).eq("athlete_id",athleteId).gte("event_date",dateMinusDaysIso(14)).order("event_date",{ascending:false}).order("occurred_at",{ascending:false}).limit(200),
      ]);
      const error=rulesResult.error??eventsResult.error;
      if(error)return finish({...empty,backendAvailable:!isBackendUnavailable(error),error:error.message});
      const rules=rulesResult.data??[],events=eventsResult.data??[];
      if(rulesResult.count!==rules.length||eventsResult.count!==events.length)
        return finish({...empty,error:"Consulta da rotina incompleta. Atualize antes de registrar."});
      return finish({...empty,rules:rules.map(mapRule),events:events.map(mapEvent)});
    }catch(cause){return finish({...empty,error:cause instanceof Error?cause.message:"Rotina indisponível."});}
  },[athleteId,scope]);
  const reload=useCallback(async()=>{
    const value=await readSnapshot();
    if(value&&!value.error&&value.backendAvailable&&!locked.current)
      setAction(previous=>previous.scope===scope?{...previous,error:null}:previous);
  },[readSnapshot,scope]);
  useEffect(()=>{
    activeScope.current=scope;epoch.current++;locked.current=false;
    setAction({scope,saving:false,error:null});
    void reload();
    return ()=>{activeScope.current=undefined;request.current++;epoch.current++;locked.current=false;};
  },[reload,scope]);
  const runAction=useCallback(async<T,>(operation:()=>Promise<T>,confirm:(value:typeof empty,result:T)=>boolean)=>{
    if(!athleteId||activeScope.current!==scope||visible.loading||visible.error||!visible.backendAvailable||currentAction.error||locked.current)
      throw new Error("Aguarde uma leitura válida do atleta atual.");
    locked.current=true;
    const token=epoch.current;
    const active=()=>activeScope.current===scope&&token===epoch.current;
    setAction({scope,saving:true,error:null});
    try{
      const result=await operation();
      if(active()){
        const confirmed=await readSnapshot();
        if(!confirmed||confirmed.error||!confirmed.backendAvailable||!confirm(confirmed,result))
          throw new Error("Gravação não confirmada. Atualize e confira a rotina antes de repetir.");
      }
      return result;
    }catch(cause){
      if(active())setAction({scope,saving:false,error:cause instanceof Error?cause.message:"Operação indisponível."});
      throw cause;
    }finally{
      if(active()){locked.current=false;setAction(previous=>previous.scope===scope?{...previous,saving:false}:previous);}
    }
  },[athleteId,scope,visible.loading,visible.error,visible.backendAvailable,currentAction.error,readSnapshot]);

  const saveRule = useCallback(
    async (input: SaveReminderRuleInput) => {
      if (!athleteId || (input.ruleId && !visible.rules.some(rule=>rule.id===input.ruleId))) throw new Error("Atleta ou regra fora da consulta atual.");
      return runAction(async () => {
        const result = await db.rpc("health_f16_save_reminder_rule", {
          p_athlete_id: athleteId,
          p_reminder_type: input.reminderType,
          p_label: input.label ?? null,
          p_enabled: input.enabled,
          p_schedule_kind: input.scheduleKind,
          p_days_of_week: input.daysOfWeek,
          p_local_time: input.localTime,
          p_interval_days: input.intervalDays ?? null,
          p_start_on: input.startOn,
          p_timezone: input.timezone,
          p_rule_id: input.ruleId ?? null,
        });
        if (result.error) {
          throw new Error(result.error.message);
        }
        return result.data;
      }, (snapshot,id)=>snapshot.rules.some(rule=>rule.id===id));
    },
    [athleteId, runAction,visible.rules],
  );

  const archiveRule = useCallback(
    async (ruleId: string) =>
      runAction(async () => {
        if(!visible.rules.some(rule=>rule.id===ruleId))throw new Error("Regra fora da consulta atual.");
        const result = await db.rpc("health_f16_archive_reminder_rule", {
          p_rule_id: ruleId,
        });
        if (result.error) {
          throw new Error(result.error.message);
        }
        return result.data;
      }, (snapshot)=>!snapshot.rules.some(rule=>rule.id===ruleId)),
    [runAction,visible.rules],
  );

  const recordEvent = useCallback(
    async (
      ruleId: string,
      eventType: ReminderEvent["eventType"],
      eventDate: string = localDateIso(),
      notes?: string | null,
    ) =>
      runAction(async () => {
        if(!visible.rules.some(rule=>rule.id===ruleId))throw new Error("Regra fora da consulta atual.");
        const result = await db.rpc("health_f16_record_reminder_event", {
          p_rule_id: ruleId,
          p_event_type: eventType,
          p_event_date: eventDate,
          p_notes: notes ?? null,
        });
        if (result.error) {
          throw new Error(result.error.message);
        }
        return result.data;
      }, (snapshot,id)=>snapshot.events.some(event=>event.id===id&&event.ruleId===ruleId&&event.eventType===eventType&&event.eventDate===eventDate)),
    [runAction,visible.rules],
  );

  return {
    rules:visible.rules,
    events:visible.events,
    loading:visible.loading,
    saving:currentAction.saving,
    backendAvailable:visible.backendAvailable,
    error:visible.error??currentAction.error,
    reload,
    saveRule,
    archiveRule,
    recordEvent,
  };
}
