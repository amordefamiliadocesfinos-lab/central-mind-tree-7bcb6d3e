import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, CalendarIcon, Clock, User, AlertTriangle, X } from 'lucide-react';
import { format, parseISO, isBefore, startOfDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { clearCrmNextAction, completeCrmNextAction, CRM_TASK_SOURCE, setCrmNextAction } from '@/lib/crm/nextAction';

interface Task {
  id: string;
  title: string;
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  due_date: string | null;
  assigned_to: string | null;
  contact_id: string | null;
  source: string | null;
  created_at: string;
}

interface AppUser { id: string; name: string; }

const PRESETS = [
  { label: 'Ligar amanhã', title: 'Ligar para o cliente', daysOffset: 1, time: '10:00' },
  { label: 'Enviar orçamento', title: 'Enviar orçamento', daysOffset: 0, time: null },
  { label: 'Cobrar retorno', title: 'Cobrar retorno', daysOffset: 2, time: '14:00' },
  { label: 'Visitar cliente', title: 'Visitar cliente', daysOffset: 3, time: '09:00' },
];

const ROOT_NODE_ID = 'd7c76db8-b7e0-4ce1-87ca-21275c346326';

export function ContactTasksPanel({ contactId }: { contactId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // form state
  const [title, setTitle] = useState('');
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState('');
  const [assignee, setAssignee] = useState<string>('');

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tasks')
      .select('id, title, status, scheduled_date, scheduled_time, due_date, assigned_to, contact_id, source, created_at')
      .eq('contact_id', contactId)
      .eq('source', CRM_TASK_SOURCE)
      .is('deleted_at', null)
      .order('scheduled_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    setTasks((data || []) as Task[]);
    setLoading(false);
  }, [contactId]);

  useEffect(() => {
    fetchTasks();
    supabase.from('app_users').select('id, name').eq('is_active', true).order('name').then(({ data }) => {
      setUsers((data || []) as AppUser[]);
    });
  }, [contactId, fetchTasks]);

  const resetForm = () => {
    setTitle(''); setDate(undefined); setTime(''); setAssignee(''); setShowForm(false);
  };

  const applyPreset = (p: typeof PRESETS[number]) => {
    setTitle(p.title);
    setDate(addDays(startOfDay(new Date()), p.daysOffset));
    setTime(p.time || '');
    setShowForm(true);
  };

  const createTask = async () => {
    if (!title.trim()) { toast.error('Informe um título'); return; }
    if (!date) { toast.error('Defina a data da próxima ação'); return; }
    const dueAt = new Date(`${format(date, 'yyyy-MM-dd')}T${time || '09:00'}:00`);
    if (Number.isNaN(dueAt.getTime())) { toast.error('Data inválida'); return; }
    try {
      await setCrmNextAction({ contactId, title: title.trim(), dueAt: dueAt.toISOString() });
    } catch {
      toast.error('Erro ao criar a próxima ação');
      return;
    }
    toast.success('Próxima ação CRM criada');
    resetForm();
    fetchTasks();
  };

  const toggleDone = async (task: Task) => {
    if (task.source === CRM_TASK_SOURCE && !task.status.includes('concl')) {
      await completeCrmNextAction(contactId);
      fetchTasks();
      return;
    }
    const newStatus = task.status === 'concluído' ? 'pendente' : 'concluído';
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
    fetchTasks();
  };

  const deleteTask = async () => {
    await clearCrmNextAction(contactId);
    fetchTasks();
  };

  const today = startOfDay(new Date());
  const overdueCount = tasks.filter(t => t.status !== 'concluído' && t.scheduled_date && isBefore(parseISO(t.scheduled_date), today)).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Tarefas</h3>
          {overdueCount > 0 && (
            <Badge variant="destructive" className="gap-1 text-[10px]">
              <AlertTriangle className="h-3 w-3" />
              {overdueCount} vencida{overdueCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        {!showForm && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowForm(true)}>
            <Plus className="h-3 w-3" /> Nova
          </Button>
        )}
      </div>

      {/* Presets */}
      {!showForm && (
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(p => (
            <Badge
              key={p.label}
              variant="outline"
              className="cursor-pointer text-[10px] hover:bg-accent"
              onClick={() => applyPreset(p)}
            >
              + {p.label}
            </Badge>
          ))}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <Input
            placeholder="Título da tarefa..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-9 text-sm"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 justify-start text-xs font-normal", !date && "text-muted-foreground")}>
                  <CalendarIcon className="h-3 w-3 mr-1.5" />
                  {date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={ptBR} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <div className="relative">
              <Clock className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-9 text-xs pl-7"
              />
            </div>
          </div>
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger className="h-9 text-xs">
              <User className="h-3 w-3 mr-1.5" />
              <SelectValue placeholder="Responsável (opcional)" />
            </SelectTrigger>
            <SelectContent>
              {users.map(u => (
                <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={resetForm}>
              <X className="h-3 w-3 mr-1" /> Cancelar
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={createTask} disabled={!title.trim()}>
              Criar tarefa
            </Button>
          </div>
        </div>
      )}

      {/* Tasks list */}
      {loading ? (
        <p className="text-xs text-muted-foreground text-center py-3">Carregando...</p>
      ) : tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">Nenhuma tarefa para este lead</p>
      ) : (
        <div className="space-y-1.5">
          {tasks.map(t => {
            const isDone = t.status === 'concluído';
            const overdue = !isDone && t.scheduled_date && isBefore(parseISO(t.scheduled_date), today);
            const userName = users.find(u => u.id === t.assigned_to)?.name;
            return (
              <div key={t.id} className={cn(
                "group flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs transition-colors",
                overdue && "border-destructive/50 bg-destructive/5",
                isDone && "opacity-60"
              )}>
                <Checkbox checked={isDone} onCheckedChange={() => toggleDone(t)} className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className={cn("font-medium", isDone && "line-through")}>{t.title}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[10px] text-muted-foreground">
                    {t.scheduled_date && (
                      <span className={cn("flex items-center gap-0.5", overdue && "text-destructive font-medium")}>
                        <CalendarIcon className="h-2.5 w-2.5" />
                        {format(parseISO(t.scheduled_date), 'dd/MM/yyyy', { locale: ptBR })}
                        {t.scheduled_time && ` • ${t.scheduled_time.slice(0, 5)}`}
                        {overdue && ' (vencida)'}
                      </span>
                    )}
                    {userName && (
                      <span className="flex items-center gap-0.5">
                        <User className="h-2.5 w-2.5" /> {userName}
                      </span>
                    )}
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteTask()} title="Cancelar próxima ação">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
