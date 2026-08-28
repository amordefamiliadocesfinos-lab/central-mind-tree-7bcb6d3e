import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ArrowLeft, CalendarClock, Search, User as UserIcon, AlertTriangle, Clock, CheckCircle2, ExternalLink, Pencil, X,
} from 'lucide-react';
import { parseISO, isBefore, startOfDay, isToday, isTomorrow, isThisWeek, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { clearCrmNextAction, completeCrmNextAction, CRM_TASK_SOURCE, setCrmNextAction } from '@/lib/crm/nextAction';
import { clearCrmReactivation, CRM_REACTIVATION_SOURCE, setCrmReactivation } from '@/lib/crm/reactivation';

interface TaskRow {
  id: string;
  title: string;
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  due_date: string | null;
  assigned_to: string | null;
  contact_id: string | null;
  source: string | null;
  contact_name?: string | null;
  assignee_name?: string | null;
}

type FilterRange = 'all' | 'overdue' | 'today' | 'tomorrow' | 'week' | 'future';
type StatusFilter = 'pendente' | 'todas' | 'concluida';

function formatDisplayDate(dateStr: string) {
  return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
}

export default function TarefasAgendadas() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<FilterRange>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pendente');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('09:00');
  const [saving, setSaving] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('tasks')
      .select('id, title, status, scheduled_date, scheduled_time, due_date, assigned_to, contact_id, source')
      .is('deleted_at', null)
      .not('contact_id', 'is', null)
      .in('source', [CRM_TASK_SOURCE, CRM_REACTIVATION_SOURCE])
      .not('scheduled_date', 'is', null)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true, nullsFirst: false });

    if (statusFilter === 'pendente') q = q.neq('status', 'concluído');
    else if (statusFilter === 'concluida') q = q.eq('status', 'concluído');

    const { data, error } = await q;
    if (error) { toast.error('Erro ao carregar tarefas'); setLoading(false); return; }

    const rows = (data || []) as TaskRow[];
    const contactIds = Array.from(new Set(rows.map(r => r.contact_id).filter(Boolean))) as string[];
    const userIds = Array.from(new Set(rows.map(r => r.assigned_to).filter(Boolean))) as string[];

    const [contactsRes, usersRes] = await Promise.all([
      contactIds.length
        ? supabase.from('contacts').select('id, name').in('id', contactIds)
        : Promise.resolve({ data: [] as any[] }),
      userIds.length
        ? supabase.from('app_users').select('id, name').in('id', userIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const cMap = new Map((contactsRes.data || []).map((c: any) => [c.id, c.name]));
    const uMap = new Map((usersRes.data || []).map((u: any) => [u.id, u.name]));

    setTasks(rows.map(r => ({
      ...r,
      contact_name: r.contact_id ? cMap.get(r.contact_id) || null : null,
      assignee_name: r.assigned_to ? uMap.get(r.assigned_to) || null : null,
    })));
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    fetchTasks();
    supabase.from('app_users').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setUsers((data || []) as any));
  }, [fetchTasks]);

  const filtered = useMemo(() => {
    const today = startOfDay(new Date());
    const q = search.trim().toLowerCase();
    return tasks.filter(t => {
      if (q) {
        const hay = `${t.title} ${t.contact_name || ''} ${t.assignee_name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (assigneeFilter !== 'all') {
        if (assigneeFilter === 'none' && t.assigned_to) return false;
        if (assigneeFilter !== 'none' && t.assigned_to !== assigneeFilter) return false;
      }
      if (range !== 'all' && t.scheduled_date) {
        const d = parseISO(t.scheduled_date);
        if (range === 'overdue' && !(isBefore(d, today) && t.status !== 'concluído')) return false;
        if (range === 'today' && !isToday(d)) return false;
        if (range === 'tomorrow' && !isTomorrow(d)) return false;
        if (range === 'week' && !isThisWeek(d, { weekStartsOn: 1 })) return false;
        if (range === 'future' && !isBefore(today, d)) return false;
      }
      return true;
    });
  }, [tasks, search, range, assigneeFilter]);

  const grouped = useMemo(() => {
    const today = startOfDay(new Date());
    const groups: Record<string, TaskRow[]> = { Atrasadas: [], Hoje: [], Amanhã: [], 'Esta semana': [], Futuras: [], 'Sem data': [] };
    filtered.forEach(t => {
      if (!t.scheduled_date) { groups['Sem data'].push(t); return; }
      const d = parseISO(t.scheduled_date);
      if (t.status !== 'concluído' && isBefore(d, today)) groups['Atrasadas'].push(t);
      else if (isToday(d)) groups['Hoje'].push(t);
      else if (isTomorrow(d)) groups['Amanhã'].push(t);
      else if (isThisWeek(d, { weekStartsOn: 1 })) groups['Esta semana'].push(t);
      else groups['Futuras'].push(t);
    });
    return groups;
  }, [filtered]);

  const counts = useMemo(() => {
    const today = startOfDay(new Date());
    return {
      total: tasks.length,
      atrasadas: tasks.filter(t => t.scheduled_date && t.status !== 'concluído' && isBefore(parseISO(t.scheduled_date), today)).length,
      hoje: tasks.filter(t => t.scheduled_date && isToday(parseISO(t.scheduled_date))).length,
      semana: tasks.filter(t => t.scheduled_date && isThisWeek(parseISO(t.scheduled_date), { weekStartsOn: 1 })).length,
    };
  }, [tasks]);

  const completeTask = async (t: TaskRow) => {
    if (!t.contact_id) return;
    try {
      if (t.source === CRM_REACTIVATION_SOURCE) {
        await clearCrmReactivation(t.contact_id);
        toast.success('Reativação concluída.');
      } else {
        await completeCrmNextAction(t.contact_id);
        toast.success('Próxima ação concluída.');
      }
      void fetchTasks();
    } catch {
      toast.error('Não foi possível concluir a próxima ação.');
    }
  };

  const cancelTask = async (t: TaskRow) => {
    if (!t.contact_id) return;
    try {
      if (t.source === CRM_REACTIVATION_SOURCE) {
        await clearCrmReactivation(t.contact_id);
        toast.success('Reativação cancelada.');
      } else {
        await clearCrmNextAction(t.contact_id);
        toast.success('Próxima ação cancelada.');
      }
      void fetchTasks();
    } catch {
      toast.error('Não foi possível cancelar a próxima ação.');
    }
  };

  const openReschedule = (t: TaskRow) => {
    setEditing(t);
    setEditTitle(t.title);
    setEditDate(t.scheduled_date || t.due_date || '');
    setEditTime(t.scheduled_time?.slice(0, 5) || '09:00');
  };

  const saveReschedule = async () => {
    if (!editing?.contact_id || !editTitle.trim() || !editDate) {
      toast.error('Informe título e nova data.');
      return;
    }
    const dueAt = new Date(`${editDate}T${editTime || '09:00'}:00`);
    if (Number.isNaN(dueAt.getTime())) {
      toast.error('Data inválida.');
      return;
    }
    setSaving(true);
    try {
      if (editing.source === CRM_REACTIVATION_SOURCE) {
        await setCrmReactivation(editing.contact_id, { title: editTitle.trim(), dueAt: dueAt.toISOString() });
        toast.success('Reativação reagendada.');
      } else {
        await setCrmNextAction({ contactId: editing.contact_id, title: editTitle.trim(), dueAt: dueAt.toISOString() });
        toast.success('Próxima ação reagendada.');
      }
      setEditing(null);
      await fetchTasks();
    } catch {
      toast.error('Não foi possível reagendar a próxima ação.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen pb-20">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link to="/contatos">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              Tarefas CRM
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Card className="p-2.5 text-center border-0 shadow-sm bg-card">
            <p className="text-xl font-bold leading-tight">{counts.total}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Total</p>
          </Card>
          <Card className="p-2.5 text-center border-0 shadow-sm bg-red-50 dark:bg-red-950/30">
            <p className="text-xl font-bold text-red-700 dark:text-red-400 leading-tight">{counts.atrasadas}</p>
            <p className="text-[10px] text-red-600 font-medium">Atrasadas</p>
          </Card>
          <Card className="p-2.5 text-center border-0 shadow-sm bg-amber-50 dark:bg-amber-950/30">
            <p className="text-xl font-bold text-amber-700 dark:text-amber-400 leading-tight">{counts.hoje}</p>
            <p className="text-[10px] text-amber-600 font-medium">Hoje</p>
          </Card>
          <Card className="p-2.5 text-center border-0 shadow-sm bg-blue-50 dark:bg-blue-950/30">
            <p className="text-xl font-bold text-blue-700 dark:text-blue-400 leading-tight">{counts.semana}</p>
            <p className="text-[10px] text-blue-600 font-medium">Esta semana</p>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 h-9" placeholder="Buscar tarefa, contato ou responsável..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={range} onValueChange={(v) => setRange(v as FilterRange)}>
            <SelectTrigger className="h-9 w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas datas</SelectItem>
              <SelectItem value="overdue">Atrasadas</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="tomorrow">Amanhã</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="future">Futuras</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="h-9 w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="concluida">Concluídas</SelectItem>
              <SelectItem value="todas">Todas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="h-9 w-full sm:w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos responsáveis</SelectItem>
              <SelectItem value="none">Sem responsável</SelectItem>
              {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="px-4 py-4 space-y-6">
        {loading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <CalendarClock className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Nenhuma tarefa encontrada com esses filtros.</p>
          </Card>
        ) : (
          Object.entries(grouped).map(([label, list]) => list.length === 0 ? null : (
            <div key={label}>
              <div className="flex items-center gap-2 mb-2">
                <h2 className={cn(
                  "text-sm font-semibold",
                  label === 'Atrasadas' && 'text-red-600',
                  label === 'Hoje' && 'text-amber-600',
                )}>{label}</h2>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{list.length}</Badge>
              </div>
              <div className="space-y-2">
                {list.map(t => {
                  const overdue = t.scheduled_date && t.status !== 'concluído' && isBefore(parseISO(t.scheduled_date), startOfDay(new Date()));
                  return (
                    <Card key={t.id} className={cn("p-3 flex items-start gap-3", overdue && "border-red-300 dark:border-red-900")}>
                      <Checkbox checked={t.status === 'concluído'} onCheckedChange={() => void completeTask(t)} className="mt-1" aria-label={`Concluir ${t.title}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn("font-medium text-sm leading-snug", t.status === 'concluído' && 'line-through text-muted-foreground')}>
                            {t.title}
                          </p>
                          <Badge variant={t.source === CRM_REACTIVATION_SOURCE ? 'secondary' : 'outline'} className="h-5 text-[10px]">
                            {t.source === CRM_REACTIVATION_SOURCE ? 'Reativação' : 'Próxima ação'}
                          </Badge>
                          {overdue && <Badge variant="destructive" className="h-5 text-[10px] gap-1"><AlertTriangle className="h-3 w-3" />Atrasada</Badge>}
                          {t.status === 'concluído' && <Badge className="h-5 text-[10px] bg-green-600 gap-1"><CheckCircle2 className="h-3 w-3" />Concluída</Badge>}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                          {t.scheduled_date && (
                            <span className="flex items-center gap-1">
                              <CalendarClock className="h-3 w-3" />
                              {formatDisplayDate(t.scheduled_date)}
                              {t.scheduled_time && <><Clock className="h-3 w-3 ml-1" />{t.scheduled_time.slice(0, 5)}</>}
                            </span>
                          )}
                          {t.assignee_name && (
                            <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" />{t.assignee_name}</span>
                          )}
                          {t.contact_name && t.contact_id && (
                            <Link to={`/contatos/inbox?contact=${t.contact_id}`} className="text-primary hover:underline">
                              {t.contact_name}
                            </Link>
                          )}
                        </div>
                      </div>
                      {t.contact_id && t.status !== 'concluído' && (
                        <div className="flex shrink-0 items-center gap-1">
                          <Link to={`/contatos/inbox?contact=${t.contact_id}`}><Button size="icon" variant="ghost" className="h-7 w-7" title="Abrir na Caixa de Entrada"><ExternalLink className="h-3.5 w-3.5" /></Button></Link>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openReschedule(t)} title="Reagendar"><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => void cancelTask(t)} title="Cancelar"><X className="h-3.5 w-3.5" /></Button>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.source === CRM_REACTIVATION_SOURCE ? 'Reagendar reativação' : 'Reagendar próxima ação'}</DialogTitle>
            <DialogDescription>Atualiza a mesma obrigação CRM, sem criar uma segunda tarefa.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} placeholder="Próxima ação" />
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)} />
              <Input type="time" value={editTime} onChange={(event) => setEditTime(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Voltar</Button>
            <Button onClick={() => void saveReschedule()} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
