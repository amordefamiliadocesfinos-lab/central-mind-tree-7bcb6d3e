import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { 
  Play, Pause, RotateCcw, Clock, Focus, Calendar, Timer, 
  ShoppingCart, FileText, Undo2, Redo2, Home, FileSpreadsheet,
  Users, User, UsersRound, DollarSign, Brain, LayoutDashboard,
  UserPlus, MoreHorizontal, Truck, Settings2, Eye, EyeOff, GraduationCap, Target,
  Lightbulb, Inbox,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUndoRedoContext } from "@/contexts/UndoRedoContext";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { CRM_GLOBAL_ENTRY_PATH, isGlobalNavigationItemActive } from "@/lib/crm/crmGlobalNavigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLinesMode } from "@/contexts/LinesModeContext";
import { CollaboratorsPanel } from "./CollaboratorsPanel";
import { NucleoLauncherButton } from "./NucleoLauncherButton";
import { ActiveUserPicker } from "./ActiveUserPicker";
import { RoutineAlertsToggleButton } from "./routine/RoutineAlertsToggleButton";
import { AssistantPanel } from "./assistant";

interface Task {
  id: string;
  status: "estrutural" | "andamento" | "pendente" | "concluído";
}

const NAV_ITEMS = [
  { path: "/", label: "Árvore", shortLabel: "Árvore", icon: Home },
  { path: "/dashboard", label: "Dashboard", shortLabel: "Painel", icon: LayoutDashboard },
  { path: "/foco", label: "Foco", shortLabel: "Foco", icon: Focus },
  { path: "/calendario", label: "Calendário", shortLabel: "Agenda", icon: Calendar },
  { path: "/rotina", label: "Rotina", shortLabel: "Rotina", icon: Timer },
  { path: "/operacoes", label: "Operações", shortLabel: "Ops", icon: ShoppingCart },
  { path: "/digital", label: "Digital", shortLabel: "Digital", icon: FileText },
  { path: "/planilhas", label: "Planilhas", shortLabel: "Planilhas", icon: FileSpreadsheet },
  { path: "/reunioes", label: "Reuniões", shortLabel: "Reuniões", icon: Users },
  { path: "/minha-area", label: "Minha Área", shortLabel: "Minha", icon: User },
  { path: CRM_GLOBAL_ENTRY_PATH, label: "CRM", shortLabel: "CRM", icon: UserPlus },
  { path: "/rotas", label: "Rotas", shortLabel: "Rotas", icon: Truck },
  { path: "/financeiro", label: "Financeiro", shortLabel: "Financeiro", icon: DollarSign },
  { path: "/academia", label: "Academia", shortLabel: "Academia", icon: GraduationCap },
  { path: "/metas", label: "Metas", shortLabel: "Metas", icon: Target },
  { path: "/oportunidades", label: "Oportunidades", shortLabel: "Oportunidades", icon: Lightbulb },
  { path: "/captura", label: "Captura Central", shortLabel: "Captura", icon: Inbox },
] as const;

const MOBILE_PRIMARY_PATHS = ["/dashboard", "/foco", CRM_GLOBAL_ENTRY_PATH, "/operacoes", "/captura"] as const;
const MOBILE_FALLBACK_PATH = "/financeiro";
const DESKTOP_PRIMARY_PATHS = ["/dashboard", "/foco", CRM_GLOBAL_ENTRY_PATH, "/operacoes", "/rotina", "/digital", "/financeiro", "/captura"] as const;
const FOOTER_NAV_LABEL_CLASS = "text-[11px] font-medium leading-none";
const FOOTER_MOBILE_LABEL_CLASS = "block w-full max-w-[3.75rem] overflow-hidden truncate text-center";

// Request notification permission on component mount
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// Show browser notification for high-priority insights
function showInsightNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'ai-insight',
      requireInteraction: true,
    });

    notification.onclick = () => {
      window.focus();
      window.location.href = '/assistente';
      notification.close();
    };

    // Auto-close after 10 seconds
    setTimeout(() => notification.close(), 10000);
  }
}

// AI Assistant Button component with pending count badge
function AIAssistantButton({ isActive }: { isActive: (path: string) => boolean }) {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Request notification permission when component mounts
    requestNotificationPermission();

    const fetchPendingCount = async () => {
      try {
        const { count, error } = await supabase
          .from('ai_insights')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'proposto');
        
        if (!error && count !== null) {
          setPendingCount(count);
        }
      } catch (e) {
        console.error('Error fetching AI insights count:', e);
      }
    };

    fetchPendingCount();

    // Subscribe to changes - detect new high-priority insights
    const channel = supabase
      .channel('ai-insights-badge')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_insights' },
        (payload) => {
          fetchPendingCount();
          
          // Show notification for high severity (alta) insights
          const newInsight = payload.new as { 
            title: string; 
            description: string | null; 
            severity: string;
            area: string;
          };
          
          if (newInsight.severity === 'alta') {
            showInsightNotification(
              `⚠️ ${newInsight.area}: ${newInsight.title}`,
              newInsight.description || 'Nova sugestão de alta prioridade do Assistente IA'
            );
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ai_insights' },
        () => fetchPendingCount()
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'ai_insights' },
        () => fetchPendingCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          size="sm"
          variant={isActive('/assistente') ? 'secondary' : 'ghost'}
          className={cn("h-7 w-7 p-0 relative", isActive('/assistente') && "bg-secondary")}
        >
          <Link to="/assistente">
            <Brain className="h-4 w-4" />
            {pendingCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center"
              >
                {pendingCount > 9 ? '9+' : pendingCount}
              </Badge>
            )}
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Assistente IA</TooltipContent>
    </Tooltip>
  );
}

// Timer sound - simple beep using Web Audio API
function playAlertSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.frequency.value = 880; // A5 note
    oscillator.type = "sine";
    gainNode.gain.value = 0.3;

    oscillator.start();
    
    // Beep pattern: 3 short beeps
    setTimeout(() => { gainNode.gain.value = 0; }, 200);
    setTimeout(() => { gainNode.gain.value = 0.3; }, 400);
    setTimeout(() => { gainNode.gain.value = 0; }, 600);
    setTimeout(() => { gainNode.gain.value = 0.3; }, 800);
    setTimeout(() => { 
      oscillator.stop();
      audioCtx.close();
    }, 1000);
  } catch (e) {
    console.error('Failed to play sound:', e);
  }
}

export function GlobalFooterBar() {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [status, setStatus] = useState<"stopped" | "running" | "paused">("stopped");
  const [isEditing, setIsEditing] = useState(false);
  const [timeInput, setTimeInput] = useState("00:00:00");
  const [stateId, setStateId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [collaboratorsOpen, setCollaboratorsOpen] = useState(false);
  const [footerHeight, setFooterHeight] = useState<number>(() => {
    const saved = parseInt(localStorage.getItem("footerHeight") || "");
    return Number.isFinite(saved) && saved >= 0 && saved <= 64 ? saved : 30;
  });
  const [footerHidden, setFooterHidden] = useState<boolean>(() => {
    return localStorage.getItem("footerHidden") === "true";
  });

  useEffect(() => {
    localStorage.setItem("footerHidden", String(footerHidden));
    if (footerHidden && window.matchMedia("(min-width: 768px)").matches) {
      document.body.style.paddingBottom = "0px";
    }
  }, [footerHidden]);

  // Persist + apply CSS variables so buttons scale proportionally and body padding follows
  useEffect(() => {
    localStorage.setItem("footerHeight", String(footerHeight));
    document.documentElement.style.setProperty("--footer-h", `${footerHeight}px`);
    // A docked toolbar must reserve its real minimum height without shrinking buttons.
    const effectiveDesktopHeight = footerHidden || footerHeight === 0 ? 0 : Math.max(footerHeight, 36);
    document.documentElement.style.setProperty("--footer-effective-h", `${effectiveDesktopHeight}px`);
    // buttons ~ 92% of bar, icons ~ 50%
    document.documentElement.style.setProperty("--footer-btn", `${Math.round(footerHeight * 0.92)}px`);
    document.documentElement.style.setProperty("--footer-icon", `${Math.max(12, Math.round(footerHeight * 0.5))}px`);
    document.documentElement.style.setProperty("--footer-font", `${Math.max(10, Math.round(footerHeight * 0.36))}px`);
    if (window.matchMedia("(min-width: 768px)").matches) {
      document.body.style.paddingBottom = `${effectiveDesktopHeight}px`;
    }
    return () => {
      // do not clear; user expects persistence across renders
    };
  }, [footerHeight, footerHidden]);
  const location = useLocation();
  const { toast } = useToast();
  const { undo, redo, canUndo, canRedo } = useUndoRedoContext();
  const { notify, requestPermission, permission } = useNotifications();
  const isMobile = useIsMobile();
  const { linesMode, setLinesMode, showTaskBar } = useLinesMode();
  const isActive = (path: string) => isGlobalNavigationItemActive(location.pathname, path);
  const activeMobileItem = NAV_ITEMS.find((item) => isActive(item.path));
  const mobilePrimaryItems = NAV_ITEMS.filter((item) => MOBILE_PRIMARY_PATHS.includes(item.path as (typeof MOBILE_PRIMARY_PATHS)[number]));
  const mobileOverflowItems = NAV_ITEMS.filter((item) => !MOBILE_PRIMARY_PATHS.includes(item.path as (typeof MOBILE_PRIMARY_PATHS)[number]));
  const mobileMoreItem = activeMobileItem && !MOBILE_PRIMARY_PATHS.includes(activeMobileItem.path as (typeof MOBILE_PRIMARY_PATHS)[number])
    ? activeMobileItem
    : NAV_ITEMS.find((item) => item.path === MOBILE_FALLBACK_PATH) ?? mobileOverflowItems[0];
  const desktopPrimaryItems = NAV_ITEMS.filter((item) => DESKTOP_PRIMARY_PATHS.includes(item.path as (typeof DESKTOP_PRIMARY_PATHS)[number]));
  const desktopOverflowItems = NAV_ITEMS.filter((item) => !DESKTOP_PRIMARY_PATHS.includes(item.path as (typeof DESKTOP_PRIMARY_PATHS)[number]));
  const hasActiveDesktopOverflow = desktopOverflowItems.some((item) => isActive(item.path));

  // Fetch tasks for status counters
  useEffect(() => {
    if (!showTaskBar) return;
    
    const fetchTasks = async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, status")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setTasks(data as Task[]);
      }
    };

    fetchTasks();

    const channel = supabase
      .channel('tasks-footer')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks'
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [showTaskBar]);

  const statusCounts = {
    estrutural: tasks.filter(t => t.status === "estrutural").length,
    andamento: tasks.filter(t => t.status === "andamento").length,
    pendente: tasks.filter(t => t.status === "pendente").length,
    concluído: tasks.filter(t => t.status === "concluído").length,
  };

  // Track local saves to ignore echo events from our own writes
  const lastLocalSaveAt = useRef(0);
  // Timestamp anchor: absolute moment when the timer should reach zero (ms epoch).
  // This is the single source of truth while running — immune to tab throttling,
  // background sleep, mobile lock screens, and route changes.
  const endsAtRef = useRef<number | null>(null);
  // Guard so the completion sound/notification fires exactly once per countdown.
  const completedRef = useRef(false);

  const statusRef = useRef(status);
  statusRef.current = status;
  const remainingRef = useRef(remainingSeconds);
  remainingRef.current = remainingSeconds;

  useEffect(() => {
    loadTimerState();

    const channel = supabase
      .channel('timer-state-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'timer_state',
        },
        (payload) => {
          // Ignore echoes of our own writes (within 3s of last local save)
          if (Date.now() - lastLocalSaveAt.current < 3000) return;
          // Skip realtime events while timer is running or paused locally
          if (statusRef.current === 'running' || statusRef.current === 'paused') {
            return;
          }
          const next = payload.new as { id: string; remaining_seconds: number; status: string; last_update?: string };
          if (!next?.id) return;
          setStateId(next.id);
          const nextStatus = (next.status as "stopped" | "running" | "paused") ?? "stopped";
          if (nextStatus === 'running' && next.last_update) {
            const elapsed = Math.floor((Date.now() - new Date(next.last_update).getTime()) / 1000);
            const adjusted = Math.max(0, (next.remaining_seconds ?? 0) - elapsed);
            endsAtRef.current = Date.now() + adjusted * 1000;
            completedRef.current = adjusted <= 0;
            setRemainingSeconds(adjusted);
            setStatus(adjusted <= 0 ? 'stopped' : 'running');
          } else {
            endsAtRef.current = null;
            completedRef.current = nextStatus === 'stopped' && (next.remaining_seconds ?? 0) <= 0;
            setRemainingSeconds(next.remaining_seconds ?? 0);
            setStatus(nextStatus);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Timestamp-anchored countdown: re-derive remaining from (endsAt - now).
  // Tick every 250ms purely to refresh the display; never mutate the source of truth.
  useEffect(() => {
    if (status !== 'running') return;
    if (endsAtRef.current == null) {
      endsAtRef.current = Date.now() + remainingRef.current * 1000;
    }

    const tick = () => {
      const end = endsAtRef.current;
      if (end == null) return;
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setRemainingSeconds(left);
      if (left <= 0 && !completedRef.current) {
        completedRef.current = true;
        endsAtRef.current = null;
        setStatus('stopped');
        playAlertSound();
        notify('Timer finalizado!', {
          body: 'Seu tempo de foco terminou.',
          tag: 'timer-complete',
        });
        toast({ title: 'Timer finalizado!' });
        if (stateId) {
          lastLocalSaveAt.current = Date.now();
          supabase
            .from('timer_state')
            .update({ remaining_seconds: 0, status: 'stopped', last_update: new Date().toISOString() })
            .eq('id', stateId);
        }
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 250);
    // Recompute on tab focus / visibility change to catch any drift.
    const onVisible = () => tick();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [status, stateId]);

  useEffect(() => {
    if (!stateId) return;
    saveTimerState();
  }, [status, stateId]);

  useEffect(() => {
    if (!stateId || status !== 'running') return;
    const saveInterval = window.setInterval(() => {
      saveTimerState();
    }, 5000);
    return () => clearInterval(saveInterval);
  }, [status, stateId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Ctrl/Cmd + Z = Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y = Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      // Alt + 1 = Home
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        window.location.href = '/';
      }
      // Alt + 2 = Foco
      if (e.altKey && e.key === '2') {
        e.preventDefault();
        window.location.href = '/foco';
      }
      // Alt + 3 = Calendar
      if (e.altKey && e.key === '3') {
        e.preventDefault();
        window.location.href = '/calendario';
      }
      // Alt + 4 = Rotina
      if (e.altKey && e.key === '4') {
        e.preventDefault();
        window.location.href = '/rotina';
      }
      // Space = Start/Pause timer (only on certain pages)
      if (e.code === 'Space' && location.pathname === '/foco') {
        // Already handled in Foco page
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, location.pathname]);

  const loadTimerState = async () => {
    const { data, error } = await supabase
      .from("timer_state")
      .select("*")
      .limit(1)
      .single();

    if (!error && data) {
      setStateId(data.id);
      const savedStatus = data.status as "stopped" | "running" | "paused";

      if (savedStatus === "running" && data.last_update) {
        // Recalculate remaining time based on elapsed time since last_update
        const elapsedSinceLastSave = Math.floor(
          (Date.now() - new Date(data.last_update).getTime()) / 1000
        );
        const adjusted = data.remaining_seconds - elapsedSinceLastSave;

        if (adjusted <= 0) {
          // Timer already expired while tab was closed — finalize silently (no beep loop)
          endsAtRef.current = null;
          completedRef.current = true;
          setRemainingSeconds(0);
          setStatus("stopped");
          await supabase
            .from("timer_state")
            .update({ remaining_seconds: 0, status: "stopped", last_update: new Date().toISOString() })
            .eq("id", data.id);
        } else {
          endsAtRef.current = Date.now() + adjusted * 1000;
          completedRef.current = false;
          setRemainingSeconds(adjusted);
          setStatus("running");
        }
      } else {
        endsAtRef.current = null;
        completedRef.current = savedStatus === "stopped" && (data.remaining_seconds ?? 0) <= 0;
        setRemainingSeconds(data.remaining_seconds);
        setStatus(savedStatus);
      }
    }
  };

  const saveTimerState = async () => {
    if (!stateId) return;
    lastLocalSaveAt.current = Date.now();
    await supabase
      .from("timer_state")
      .update({
        remaining_seconds: remainingRef.current,
        status: statusRef.current,
        last_update: new Date().toISOString(),
      })
      .eq("id", stateId);
  };

  // handleTimerComplete is now handled via the useEffect that watches remainingSeconds reaching 0

  const handleStart = async () => {
    if (remainingSeconds > 0) {
      // Request notification permission on first start
      if (permission === 'default') {
        await requestPermission();
      }
      endsAtRef.current = Date.now() + remainingSeconds * 1000;
      completedRef.current = false;
      setStatus("running");
    } else {
      toast({
        variant: "destructive",
        title: "Defina um tempo primeiro",
      });
    }
  };

  const handlePause = () => {
    // Freeze remaining at the exact moment of pause based on the anchor.
    if (endsAtRef.current != null) {
      const left = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000));
      remainingRef.current = left;
      setRemainingSeconds(left);
    }
    endsAtRef.current = null;
    setStatus("paused");
  };
  const handleResume = () => {
    endsAtRef.current = Date.now() + remainingRef.current * 1000;
    completedRef.current = false;
    setStatus("running");
  };

  const handleStop = () => {
    endsAtRef.current = null;
    completedRef.current = true;
    setStatus("stopped");
  };

  const handleReset = () => {
    endsAtRef.current = null;
    completedRef.current = true;
    setStatus("stopped");
    setRemainingSeconds(0);
  };

  const handleSetTime = () => {
    const parts = timeInput.split(":");
    if (parts.length !== 3) {
      toast({
        variant: "destructive",
        title: "Formato inválido. Use hh:mm:ss",
      });
      return;
    }

    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseInt(parts[2]) || 0;
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;

    if (totalSeconds <= 0) {
      toast({
        variant: "destructive",
        title: "Tempo deve ser maior que zero",
      });
      return;
    }

    setStatus("stopped");
    setRemainingSeconds(totalSeconds);
    setIsEditing(false);
    // Persist immediately so the configured time survives reloads
    if (stateId) {
      lastLocalSaveAt.current = Date.now();
      supabase
        .from("timer_state")
        .update({
          remaining_seconds: totalSeconds,
          status: "stopped",
          last_update: new Date().toISOString(),
        })
        .eq("id", stateId);
    }
    toast({ title: "Tempo definido" });
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // When fully hidden, render only a tiny show handle
  if (footerHidden) {
    return (
      <div data-global-footer="true" className="fixed bottom-1 right-2 z-[9999]">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-6 w-6 p-0 rounded-full shadow opacity-50 hover:opacity-100"
              onClick={() => setFooterHidden(false)}
              aria-label="Mostrar barra inferior"
            >
              <Eye className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Mostrar barra inferior</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  // When collapsed to 0 on desktop, render only a tiny restore handle
  const isDesktopCollapsed = footerHeight === 0 && typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;

  if (isDesktopCollapsed) {
    return (
      <div data-global-footer="true" className="fixed bottom-1 right-2 z-[9999]">
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-6 w-6 p-0 rounded-full shadow" title="Mostrar barra inferior">
              <Settings2 className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-64 p-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span>Altura da barra</span>
                <span className="text-muted-foreground">{footerHeight}px</span>
              </div>
              <Slider min={0} max={64} step={1} value={[footerHeight]} onValueChange={(v) => setFooterHeight(v[0])} />
              <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => setFooterHeight(30)}>
                Restaurar padrão (30px)
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div data-global-footer="true" className="fixed inset-x-0 bottom-0 z-[9999] flex justify-center pointer-events-none" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      {/* Single global dock: centered, content-sized and flush with the viewport bottom. */}
      <div
        className="pointer-events-auto flex w-full md:w-max max-w-full md:max-w-[calc(100vw-0.5rem)] flex-wrap md:flex-nowrap items-center justify-between md:justify-center gap-1.5 md:gap-1 rounded-t-2xl border border-b-0 border-border bg-background/95 px-2 md:px-3 shadow-[0_-2px_16px_rgba(0,0,0,0.12)] backdrop-blur-md md:[min-height:var(--footer-h,30px)] md:overflow-x-auto scrollbar-none"
      >
        {/* Left: Task status counters + Lines mode (only when showTaskBar is true) */}
        {showTaskBar && tasks.length > 0 ? (
          <div className="flex items-center gap-1">
            {/* Status counter buttons */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "h-6 w-6 md:h-7 md:w-7 rounded-full flex items-center justify-center text-[10px] md:text-xs font-semibold",
                    statusCounts.estrutural > 0 ? "bg-node-roxo text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  {statusCounts.estrutural}
                </button>
              </TooltipTrigger>
              <TooltipContent>Estrutural</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "h-6 w-6 md:h-7 md:w-7 rounded-full flex items-center justify-center text-[10px] md:text-xs font-semibold",
                    statusCounts.andamento > 0 ? "bg-node-vermelho text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  {statusCounts.andamento}
                </button>
              </TooltipTrigger>
              <TooltipContent>Em andamento</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "h-6 w-6 md:h-7 md:w-7 rounded-full flex items-center justify-center text-[10px] md:text-xs font-semibold",
                    statusCounts.pendente > 0 ? "bg-node-amarelo text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  {statusCounts.pendente}
                </button>
              </TooltipTrigger>
              <TooltipContent>Pendente</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "h-6 w-6 md:h-7 md:w-7 rounded-full flex items-center justify-center text-[10px] md:text-xs font-semibold",
                    statusCounts.concluído > 0 ? "bg-node-verde text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  {statusCounts.concluído}
                </button>
              </TooltipTrigger>
              <TooltipContent>Concluído</TooltipContent>
            </Tooltip>

            {/* Divider */}
            <div className="h-4 w-px bg-border mx-0.5" />

            {/* Lines mode selector */}
            <div className="flex items-center gap-0.5 bg-muted rounded p-0.5">
              <button
                onClick={() => setLinesMode("off")}
                className={cn(
                  "px-1.5 md:px-2 py-0.5 text-[10px] md:text-xs rounded transition-colors",
                  linesMode === "off" 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Off
              </button>
              <button
                onClick={() => setLinesMode("resumo")}
                className={cn(
                  "px-1.5 md:px-2 py-0.5 text-[10px] md:text-xs rounded transition-colors",
                  linesMode === "resumo" 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isMobile ? "L" : "Linhas"}
              </button>
              <button
                onClick={() => setLinesMode("ceo")}
                className={cn(
                  "px-1.5 md:px-2 py-0.5 text-[10px] md:text-xs rounded transition-colors",
                  linesMode === "ceo" 
                    ? "bg-node-vermelho text-white shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                CEO
              </button>
            </div>
          </div>
        ) : (
          /* Left: Undo/Redo (when no TaskBar) */
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={() => undo()} 
                  disabled={!canUndo}
                  size="sm" 
                  variant="ghost" 
                  className="h-7 w-7 p-0"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Desfazer (Ctrl+Z)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={() => redo()} 
                  disabled={!canRedo}
                  size="sm" 
                  variant="ghost" 
                  className="h-7 w-7 p-0"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refazer (Ctrl+Y)</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Center: Navigation */}
          <div className="basis-full md:basis-auto order-last md:order-none min-w-0 w-full md:w-auto md:flex-none border-t md:border-t-0 border-border md:border-0">
          {isMobile ? (
            <div className="grid grid-cols-5 gap-0.5 h-12 items-stretch">
              {mobilePrimaryItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <Button
                    key={item.path}
                    asChild
                    size="sm"
                    variant={active ? "secondary" : "ghost"}
                    className={cn(
                       "h-full min-w-0 rounded-none flex flex-col items-center justify-center gap-0.5 px-1 no-touch-min",
                      active && "bg-secondary"
                    )}
                  >
                    <Link to={item.path} aria-label={item.label}>
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className={cn(FOOTER_NAV_LABEL_CLASS, FOOTER_MOBILE_LABEL_CLASS)}>{item.shortLabel}</span>
                    </Link>
                  </Button>
                );
              })}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant={mobileMoreItem && isActive(mobileMoreItem.path) ? "secondary" : "ghost"}
                    className={cn(
                      "h-full min-w-0 rounded-none flex flex-col items-center justify-center gap-0.5 px-1 no-touch-min",
                      mobileMoreItem && isActive(mobileMoreItem.path) && "bg-secondary"
                    )}
                    aria-label="Mais funcionalidades"
                  >
                    {mobileMoreItem ? <mobileMoreItem.icon className="h-4 w-4 shrink-0" /> : <MoreHorizontal className="h-4 w-4 shrink-0" />}
                    <span className={cn(FOOTER_NAV_LABEL_CLASS, FOOTER_MOBILE_LABEL_CLASS)}>
                      {mobileMoreItem && isActive(mobileMoreItem.path) ? mobileMoreItem.shortLabel : "Mais"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="w-56 mb-2">
                  <DropdownMenuLabel>Mais funcionalidades</DropdownMenuLabel>
                  {mobileOverflowItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem key={item.path} asChild>
                        <Link to={item.path} className="flex items-center gap-2 w-full">
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/assistente" className="flex items-center gap-2 w-full">
                      <Brain className="h-4 w-4" />
                      <span>Assistente IA</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCollaboratorsOpen(true)} className="flex items-center gap-2">
                    <UsersRound className="h-4 w-4" />
                    <span>Colaboradores</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto w-full md:w-auto md:flex-none justify-center h-11 md:h-auto px-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}>
              {desktopPrimaryItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>
                      <Button
                        asChild
                        size="sm"
                        variant={active ? "secondary" : "ghost"}
                        className={cn(
                          "h-7 w-auto px-2",
                          active && "bg-secondary"
                        )}
                      >
                        <Link to={item.path}>
                          <Icon className="h-4 w-4" />
                          <span className={cn(FOOTER_NAV_LABEL_CLASS, "ml-1.5")}>{item.shortLabel}</span>
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{item.label}</TooltipContent>
                  </Tooltip>
                );
              })}

              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant={hasActiveDesktopOverflow ? "secondary" : "ghost"}
                        className={cn("h-7 px-2", hasActiveDesktopOverflow && "bg-secondary")}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className={cn(FOOTER_NAV_LABEL_CLASS, "ml-1.5")}>Mais</span>
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Mais módulos</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="center" side="top" className="w-56 mb-2">
                  <DropdownMenuLabel>Outros módulos</DropdownMenuLabel>
                  {desktopOverflowItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem key={item.path} asChild>
                        <Link to={item.path} className="flex items-center gap-2 w-full">
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/assistente" className="flex items-center gap-2 w-full">
                      <Brain className="h-4 w-4" />
                      <span>Assistente IA</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCollaboratorsOpen(true)} className="flex items-center gap-2">
                    <UsersRound className="h-4 w-4" />
                    <span>Colaboradores</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Collaborators Panel */}
        <CollaboratorsPanel 
          open={collaboratorsOpen} 
          onOpenChange={setCollaboratorsOpen} 
        />

        {/* Right: Footer height adjuster + Timer */}
        <div className="flex shrink-0 items-center gap-1 md:gap-2">
          {/* Hide footer button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => setFooterHidden(true)}
                aria-label="Ocultar barra inferior"
              >
                <EyeOff className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Ocultar barra</TooltipContent>
          </Tooltip>
          {/* Height adjuster (desktop only) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="hidden md:inline-flex h-7 w-7 p-0"
                title="Ajustar altura da barra"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-64 p-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span>Altura da barra</span>
                  <span className="text-muted-foreground">{footerHeight}px</span>
                </div>
                <Slider
                  min={0}
                  max={64}
                  step={1}
                  value={[footerHeight]}
                  onValueChange={(v) => setFooterHeight(v[0])}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0</span><span>32</span><span>64</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs"
                  onClick={() => setFooterHeight(30)}
                >
                  Restaurar padrão (30px)
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {isEditing ? (
            <div className="flex items-center gap-1">
              <Input
                placeholder="hh:mm:ss"
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSetTime()}
                className="text-center w-16 md:w-20 h-7 text-xs"
                autoFocus
              />
              <Button onClick={handleSetTime} size="sm" className="h-7 px-2 text-xs">
                OK
              </Button>
              <Button
                onClick={() => setIsEditing(false)}
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
              >
                ✕
              </Button>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  "text-sm md:text-lg font-mono cursor-pointer hover:text-primary transition-colors px-1 md:px-2",
                  status === "running" && "text-primary"
                )}
                onClick={() => {
                  if (status === "stopped") {
                    setIsEditing(true);
                    setTimeInput(formatTime(remainingSeconds));
                  }
                }}
                title={status === "stopped" ? "Clique para ajustar tempo" : undefined}
              >
                {formatTime(remainingSeconds)}
              </div>

              <div className="flex items-center gap-0.5">
                {status === "stopped" && (
                  <>
                    <Button onClick={handleStart} size="sm" variant="ghost" className="h-7 w-7 p-0">
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                    {!isMobile && (
                      <Button
                        onClick={() => {
                          setIsEditing(true);
                          setTimeInput(formatTime(remainingSeconds));
                        }}
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                      >
                        <Clock className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </>
                )}

                {status === "running" && (
                  <>
                    <Button onClick={handlePause} size="sm" variant="ghost" className="h-7 w-7 p-0" title="Pausar">
                      <Pause className="h-3.5 w-3.5" />
                    </Button>
                    <Button onClick={handleStop} size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" title="Parar">
                      ■
                    </Button>
                  </>
                )}

                {status === "paused" && (
                  <>
                    <Button onClick={handleResume} size="sm" variant="ghost" className="h-7 w-7 p-0" title="Retomar">
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                    <Button onClick={handleStop} size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" title="Parar">
                      ■
                    </Button>
                  </>
                )}

                {(status === "running" || status === "paused") && (
                  <Button onClick={handleReset} size="sm" variant="ghost" className="h-7 w-7 p-0" title="Zerar">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Global controls now share the same footer dock on every authenticated route. */}
        <div className="hidden md:block h-5 w-px shrink-0 bg-border mx-1" aria-hidden="true" />
        <div className="flex shrink-0 items-center gap-1" aria-label="Controles globais do Painel Central">
          <NucleoLauncherButton />
          <ActiveUserPicker />
          <RoutineAlertsToggleButton />
          <AssistantPanel />
        </div>
      </div>
    </div>
  );
}
