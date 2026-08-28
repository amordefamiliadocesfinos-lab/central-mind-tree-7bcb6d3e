import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, Eye, X } from "lucide-react";
import { differenceInDays, parseISO, startOfDay, format } from "date-fns";

interface Task {
  id: string;
  title: string;
  due_date: string | null;
  node_id: string;
  status: string;
}

interface DueDateBannerProps {
  onViewTasks?: (filter: "overdue" | "upcoming") => void;
}

const SNOOZE_KEY = "pc.due.snooze";

export function DueDateBanner({ onViewTasks }: DueDateBannerProps) {
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [isSnoozed, setIsSnoozed] = useState(false);

  useEffect(() => {
    checkSnooze();
    fetchTasksWithDueDates();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("due-date-banner")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
        },
        () => {
          fetchTasksWithDueDates();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const checkSnooze = () => {
    const snoozeDate = localStorage.getItem(SNOOZE_KEY);
    if (snoozeDate) {
      const today = format(new Date(), "yyyy-MM-dd");
      setIsSnoozed(snoozeDate === today);
    } else {
      setIsSnoozed(false);
    }
  };

  const fetchTasksWithDueDates = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, due_date, node_id, status")
      .not("due_date", "is", null)
      // Próximas ações do CRM são operadas na Inbox e não devem formar uma
      // segunda fila no Planejamento.
      .or("source.is.null,source.neq.crm_next_action")
      .neq("status", "concluído");

    if (error || !data) return;

    const today = startOfDay(new Date());
    const overdue: Task[] = [];
    const upcoming: Task[] = [];

    data.forEach((task) => {
      if (!task.due_date) return;
      const dueDate = startOfDay(parseISO(task.due_date));
      const daysDiff = differenceInDays(dueDate, today);

      if (daysDiff < 0) {
        overdue.push(task as Task);
      } else if (daysDiff <= 3) {
        upcoming.push(task as Task);
      }
    });

    setOverdueTasks(overdue);
    setUpcomingTasks(upcoming);
  };

  const handleSnooze = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    localStorage.setItem(SNOOZE_KEY, today);
    setIsSnoozed(true);
  };

  // Don't show if snoozed or no relevant tasks
  if (isSnoozed || (overdueTasks.length === 0 && upcomingTasks.length === 0)) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="bg-card border shadow-lg rounded-lg px-4 py-3 flex items-center gap-4">
        <div className="flex items-center gap-3">
          {overdueTasks.length > 0 && (
            <div className="flex items-center gap-1.5 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                {overdueTasks.length} {overdueTasks.length === 1 ? "vencida" : "vencidas"}
              </span>
            </div>
          )}
          {upcomingTasks.length > 0 && (
            <div className="flex items-center gap-1.5 text-amber-500">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">
                {upcomingTasks.length} {upcomingTasks.length === 1 ? "próxima" : "próximas"}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onViewTasks && (
            <>
              {overdueTasks.length > 0 && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onViewTasks("overdue")}
                  className="h-7 text-xs"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Ver vencidas
                </Button>
              )}
              {upcomingTasks.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onViewTasks("upcoming")}
                  className="h-7 text-xs border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Ver próximas
                </Button>
              )}
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSnooze}
            className="h-7 text-xs text-muted-foreground"
          >
            <X className="h-3 w-3 mr-1" />
            Adiar hoje
          </Button>
        </div>
      </div>
    </div>
  );
}
