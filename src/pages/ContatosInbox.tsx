import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ContactTimeline } from '@/components/crm/ContactTimeline';
import { ContactChatPanel } from '@/components/crm/ContactChatPanel';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ContactAvatar } from '@/components/crm/ContactAvatar';
import { MergeDuplicatesDialog } from '@/components/crm/MergeDuplicatesDialog';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Search, MessageCircle, Phone, ExternalLink, Sparkles, Loader2, Merge, Clock, UserCheck, UserMinus, CheckCircle2, RotateCcw, ArrowRight, PanelRight, Archive, X, Tag, ShoppingCart, Eye, EyeOff, ChevronDown, SlidersHorizontal, MoreHorizontal } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useContactTags } from '@/hooks/useContactTags';
import { InboxNoteBlock } from '@/components/crm/InboxNoteBlock';
import { InboxSaleDialog } from '@/components/crm/InboxSaleDialog';
import type { Contact } from '@/hooks/useContacts';
import { ContactProfileOverview } from '@/components/crm/ContactProfileOverview';
import { StartOpportunityPanel } from '@/components/crm/StartOpportunityPanel';

import { openWhatsApp } from '@/lib/whatsapp';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { getCrmStageLabel, normalizeCrmStage } from '@/lib/crm/model';
import { useActiveUser } from '@/hooks/useActiveUser';
import { useIsMobile } from '@/hooks/use-mobile';
import { MetaWindowBadge } from '@/components/crm/MetaWindowBadge';
import { AttendanceActionBar } from '@/components/crm/AttendanceActionBar';
import { createAttendanceWriteGate, isConfirmedAttendanceMutation } from '@/lib/crm/attendanceCommandSafety';
import { getConcludeAttendanceWarning, getArchiveAttendanceWarning } from '@/lib/crm/attendanceCommandPresentation';
import { getCrmInboxContactSwitchBlockReason, getCrmInboxNavigationBlockReason } from '@/lib/crm/crmGlobalNavigation';
import { registerCrmRouteGuard } from '@/lib/crm/crmRouteNavigationGuards';
import { isExplicitCrmAttendanceLink } from '@/lib/crm/crmContactNavigation';
import { applyAttendanceOutcome, applyCanonicalAttendanceResult, snoozeAttendance, ATTENDANCE_STATE_LABELS } from '@/lib/crm/attendance';
import { formatCrmResultNextActionDate, type CrmResultSelectionOrigin } from '@/lib/crm/resultRegistrationPresentation';
import type { CrmResultCode } from '@/lib/crm/canonical/types';
import { compareCrmPriority, getCrmPriority, isWaitingCustomerState, type CrmPriorityInput } from '@/lib/crm/priority';
import { getCrmInboxAttendanceTone, getCrmInboxBadgeToneClass, getCrmInboxPriorityRailClass, getCrmInboxPriorityTone, getCrmInboxStageTone } from '@/lib/crm/inboxVisualHierarchy';
import { indexCrmOperationalTasks, projectCrmOperationalState, toCrmOperationalPriorityInput, type CrmOperationalSource } from '@/lib/crm/operationalProjection';
import { getCrmInboxOrientation, getCrmOrientationShortcut, prepareCrmSupervisedAction } from '@/lib/crm/inboxOrientation';
import { getOfficialCrmNextActionAt } from '@/lib/crm/officialTask';
import { evaluateCrmHandoffEvidence, type CrmOrderLookup, type CrmReferencedOrder } from '@/lib/crm/handoffEvidence';
import { evaluateCrmOperationalActionEvidence, type CrmOrderSeparationEvidenceRow, type CrmSeparationLookup } from '@/lib/crm/handoffOperationalAction';
import { evaluateCrmHandoffQueueEvidence } from '@/lib/crm/handoffQueueEvidence';
import { resolveCampaignContext, type CampaignContext } from '@/lib/crm/campaignContext';

interface InboxItem {
  id: string;
  conversation_id: string;
  name: string;
  type: string | null;
  whatsapp: string | null;
  phone: string | null;
  photo_url: string | null;
  funnel_status: string | null;
  temperatura_lead: string | null;
  ultimo_contato: string | null;
  last_summary: string | null;
  last_date: string | null;
  unread_days: number;
  unread_count: number;
  needs_reply: boolean;
  attendance_state: string | null;
  assigned_to: string | null;
  status: string;
  channel: string | null;
  platform_name: string | null;
  platform_icon: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_message_at: string | null;
  conversation_updated_at: string | null;
  return_at: string | null;
  next_action_date: string | null;
  next_action_title: string | null;
  official_task_present: boolean;
  next_action_text: string | null;
  last_result_code: string | null;
  handoff_required: boolean | null;
  /** Somente ID explícito no evento do último Resultado canônico. */
  last_result_order_id: string | null;
  next_contact_date: string | null;
  commercial_opt_out: boolean;
  reactivation_at: string | null;
  last_result_at: string | null;
  last_no_new_fact_at: string | null;
}

type InboxFilter = 'priority' | 'needs_reply' | 'today' | 'overdue' | 'cooling';
type ConversationScope = 'commercial' | 'suppliers';
type AssignmentFilter = 'all' | 'assigned' | 'unassigned';

const OUT_OF_QUEUE_TAG_NAME = 'Fora da fila';
const OUT_OF_QUEUE_TAG_COLOR = '#6b7280';

function readAttendanceQueueScope(): string[] {
  try {
    const stored = JSON.parse(sessionStorage.getItem('crm-attendance-queue') || 'null');
    return stored?.source === 'today' && Array.isArray(stored.ids) ? stored.ids : [];
  } catch {
    return [];
  }
}

/** Adaptador visual, sem reimplementar o motor de prioridade. */
function toCrmOperationalSource(item: InboxItem): CrmOperationalSource {
  return {
    ...item,
    contactId: item.id,
    conversationId: item.conversation_id || null,
    attendance_state_updated_at: item.conversation_updated_at,
    official_task_present: item.official_task_present,
  };
}

function toCrmPriorityInput(item: InboxItem): CrmPriorityInput {
  return toCrmOperationalPriorityInput(toCrmOperationalSource(item));
}

function isPureSupplier(item: InboxItem) {
  return item.type === 'fornecedor';
}

export default function ContatosInbox() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeUserId, isLinked } = useActiveUser();
  const isMobile = useIsMobile();
  const deepLinkHandled = useRef<string | null>(null);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Uso real: refresh de realtime/Resultado não pode apagar a fila inteira.
  // O estado "Carregando..." pertence somente à primeira carga desta tela.
  const hasLoadedInboxRef = useRef(false);
  const [search, setSearch] = useState('');
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('priority');
  const [conversationScope, setConversationScope] = useState<ConversationScope>('commercial');
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [waitingCustomerOnly, setWaitingCustomerOnly] = useState(false);
  const [loadLimit, setLoadLimit] = useState(200);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const attendanceWriteGateRef = useRef(createAttendanceWriteGate());
  const [mobileStartVisible, setMobileStartVisible] = useState(true);
  // Proteção B-03: impedir troca de contato com uma seção cadastral em edição.
  const editingProfileRef = useRef(false);
  const chatDraftRef = useRef(false);
  const onChatDraftStateChange = useCallback((hasDraft: boolean) => {
    chatDraftRef.current = hasDraft;
  }, []);
  const [, setProfileEditing] = useState(false);
  const onProfileEditingChange = useCallback((editing: boolean) => {
    editingProfileRef.current = editing;
    setProfileEditing(editing);
  }, []);
  const guardProfileExit = useCallback(() => {
    if (editingProfileRef.current) {
      toast.warning('Finalize ou cancele a edição da ficha antes de trocar de contato ou área.');
      return false;
    }
    if (chatDraftRef.current) {
      toast.warning('Envie ou descarte o rascunho e aguarde o envio antes de sair deste atendimento.');
      return false;
    }
    return true;
  }, []);
  const onProfileSaved = useCallback((updated: Contact) => {
    setLeadContact(current => current?.id === updated.id ? updated : current);
    setItems(current => current.map(item => item.id === updated.id ? {
      ...item,
      name: updated.name,
      whatsapp: updated.whatsapp || null,
      phone: updated.phone || null,
      commercial_opt_out: Boolean(updated.commercial_opt_out),
      next_action_text: updated.next_action_text || null,
      next_action_date: updated.next_action_date || null,
    } : item));
  }, []);
  const [attendanceQueueScope, setAttendanceQueueScope] = useState<string[]>(readAttendanceQueueScope);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [sendConfirmation, setSendConfirmation] = useState(false);
  const [suggestedResultCode, setSuggestedResultCode] = useState<string | null>(null);
  const [attendanceActionRequest, setAttendanceActionRequest] = useState<{ mode: 'outcome' | 'snooze'; id: number; contextKey?: string } | null>(null);
  const [detailTab, setDetailTab] = useState<'conversa' | 'historico'>('conversa');
  const [replyFocusRequest, setReplyFocusRequest] = useState<{ id: number; contactId: string; conversationId: string | null; prepareAssistant: boolean } | null>(null);
  const actionRequestSequenceRef = useRef(0);
  // Em telas intermediárias a lateral funciona sob demanda; no desktop amplo já nasce aberta.
  const [leadPanelOpen, setLeadPanelOpen] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches);
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
  const [contextTab, setContextTab] = useState<'assistant' | 'lead' | 'action'>('lead');
  const [assistantPortalTarget, setAssistantPortalTarget] = useState<HTMLDivElement | null>(null);
  const [actionPortalTarget, setActionPortalTarget] = useState<HTMLDivElement | null>(null);
  const [activeActionMode, setActiveActionMode] = useState<'outcome' | 'snooze' | null>(null);
  const [orientationExpanded, setOrientationExpanded] = useState(false);
  const handleAttendanceModeChange = useCallback((mode: 'outcome' | 'snooze' | null) => {
    setActiveActionMode(mode);
    if (mode && !isMobile) {
      setLeadPanelOpen(true);
      setContextTab('action');
    } else if (!mode) {
      setContextTab(current => current === 'action' ? 'lead' : current);
    }
  }, [isMobile]);
  const [leadContact, setLeadContact] = useState<Contact | null>(null);
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [saleOpen, setSaleOpen] = useState(false);
  const [saleDecisionOpen, setSaleDecisionOpen] = useState(false);
  const [concludeIntent, setConcludeIntent] = useState<{ contactId: string; conversationId: string | null; warning: string } | null>(null);
  const [operationalHandoff, setOperationalHandoff] = useState<{ resultCode: string; label: string } | null>(null);

  // CRM-COR-01/02: ao trocar de atendimento, todo estado temporário do contato
  // anterior é descartado (Resultado sugerido, confirmação de envio).
  useEffect(() => {
    setSuggestedResultCode(null);
    setSendConfirmation(false);
    setAttendanceActionRequest(null);
    setReplyFocusRequest(null);
    setDetailTab('conversa');
    setContextTab('lead');
    setMobileProfileOpen(false);
    setActiveActionMode(null);
    setOrientationExpanded(false);
    setOperationalHandoff(null);
    setConcludeIntent(null);
  }, [selectedId]);
  const [saleDecisionBusy, setSaleDecisionBusy] = useState(false);
  const guardContactSwitch = useCallback((targetId: string | null, fromActiveOperation = false): boolean => {
    const reason = getCrmInboxContactSwitchBlockReason({
      editingProfile: editingProfileRef.current,
      pendingChatDraftOrSend: chatDraftRef.current,
      attendanceWriting: attendanceWriteGateRef.current.locked() || attendanceBusy || saleDecisionBusy,
      actionFormOpen: activeActionMode !== null,
      saleFlowOpen: saleOpen || saleDecisionOpen || concludeIntent !== null || sendConfirmation,
    }, selectedId, targetId, fromActiveOperation);
    if (!reason) return true;
    toast.warning(reason);
    return false;
  }, [selectedId, attendanceBusy, saleDecisionBusy, activeActionMode, saleOpen, saleDecisionOpen, concludeIntent, sendConfirmation]);

  const guardedSelectContact = useCallback((id: string | null, fromActiveOperation = false) => {
    if (!guardContactSwitch(id, fromActiveOperation)) return false;
    // A saída automática pós-commit continua sujeita à proteção de edição/rascunho.
    if (id !== selectedId && !guardProfileExit()) return false;
    setSelectedId(id);
    return true;
  }, [selectedId, guardContactSwitch, guardProfileExit]);

  // E-01: proteção mínima de mudança de rota, inclusive barra global fora
  // da árvore da Inbox. Em E-03 serão avaliadas outras origens de navegação.
  useEffect(() => {
    const blockReason = () => getCrmInboxNavigationBlockReason({
      editingProfile: editingProfileRef.current,
      pendingChatDraftOrSend: chatDraftRef.current,
      attendanceWriting: attendanceWriteGateRef.current.locked() || attendanceBusy || saleDecisionBusy,
      actionFormOpen: activeActionMode !== null,
      saleFlowOpen: saleOpen || saleDecisionOpen || concludeIntent !== null || sendConfirmation,
    });
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!blockReason()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const protectLinkChange = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.href === window.location.href) return;
      const reason = blockReason();
      if (!reason) return;
      event.preventDefault();
      event.stopPropagation();
      toast.warning(reason);
    };
    // Disponibiliza o mesmo contrato E-01 a navegações fora da árvore da Inbox.
    const unregisterRouteGuard = registerCrmRouteGuard(blockReason);
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', protectLinkChange, true);
    return () => {
      unregisterRouteGuard();
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', protectLinkChange, true);
    };
  }, [attendanceBusy, saleDecisionBusy, activeActionMode, saleOpen, saleDecisionOpen, concludeIntent, sendConfirmation]);
  // D-01: uma única trava síncrona para comandos que gravam estado operacional.
  // Os controles visuais usam attendanceBusy, mas o ref previne duplo clique no mesmo frame.
  const beginAttendanceOperation = (fromResultOrSnooze = false): boolean => {
    if (saleDecisionBusy || (!fromResultOrSnooze && activeActionMode)) {
      toast.warning('Conclua ou cancele a ação em andamento antes de usar outro comando.');
      return false;
    }
    if (!attendanceWriteGateRef.current.acquire()) {
      toast.warning('Aguarde a conclusão da gravação atual.');
      return false;
    }
    if (!guardProfileExit()) {
      attendanceWriteGateRef.current.release();
      return false;
    }
    setAttendanceBusy(true);
    return true;
  };
  const finishAttendanceOperation = () => {
    attendanceWriteGateRef.current.release();
    setAttendanceBusy(false);
  };
  const { tags, assignments, fetchTags } = useContactTags();
  const outOfQueueTag = useMemo(
    () => tags.find((tag) => tag.name.trim().toLocaleLowerCase('pt-BR') === OUT_OF_QUEUE_TAG_NAME.toLocaleLowerCase('pt-BR')) ?? null,
    [tags],
  );
  const outOfQueueContactIds = useMemo(
    () => new Set(assignments.filter((assignment) => assignment.tag_id === outOfQueueTag?.id).map((assignment) => assignment.contact_id)),
    [assignments, outOfQueueTag?.id],
  );
  const showingOutOfQueue = Boolean(outOfQueueTag && tagFilter === outOfQueueTag.id);

  // Carrega a ficha do lead para a barra lateral (somente quando visível).
  useEffect(() => {

    if (!leadPanelOpen || !selectedId) return;
    let cancelled = false;
    setLeadContact(null);
    void supabase.from('contacts').select('*').eq('id', selectedId).maybeSingle().then(({ data }) => {
      if (!cancelled) setLeadContact((data as unknown as Contact) ?? null);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadPanelOpen, selectedId]);

  // Busca com debounce: dispara consulta ao banco, não filtra só a página.
  const [deferredSearch, setDeferredSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDeferredSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);




  const load = useCallback(async (): Promise<InboxItem[] | null> => {
    if (!hasLoadedInboxRef.current) setLoading(true);
    const CONVERSATION_FIELDS = 'id,contact_id,contact_name,contact_handle,contact_avatar_url,last_message_preview,last_message_at,last_inbound_at,last_outbound_at,return_at,unread_count,needs_reply,attendance_state,assigned_to,funnel_stage,status,channel,platform_id,updated_at,platform:digital_platforms(name,icon)';
    const term = deferredSearch.trim();

    // Busca/estágio consultam o banco inteiro: leads antigos do Kanban não
    // podem ficar invisíveis só porque estão fora da janela recente da fila.
    const CONTACT_FIELDS = 'id,name,type,whatsapp,phone,photo_url,funnel_status,temperatura_lead,ultimo_contato,next_action_date,next_action_text,next_contact_date,commercial_opt_out,is_active';
    const outOfQueueScopedIds = showingOutOfQueue
      ? assignments.filter((assignment) => assignment.tag_id === outOfQueueTag?.id).map((assignment) => assignment.contact_id)
      : null;
    let scopedContactIds: string[] | null = null;
    let scopedContacts: any[] = [];
    if (term || stageFilter !== 'all' || outOfQueueScopedIds) {
      if (outOfQueueScopedIds?.length === 0) {
        scopedContactIds = [];
      } else {
        let contactQuery = supabase.from('contacts').select(CONTACT_FIELDS).eq('is_active', true).limit(1000);
        if (outOfQueueScopedIds) contactQuery = contactQuery.in('id', outOfQueueScopedIds);
        if (stageFilter !== 'all') contactQuery = contactQuery.eq('funnel_status', stageFilter);
        if (term) {
          const like = `%${term}%`;
          contactQuery = contactQuery.or(`name.ilike.${like},fantasy_name.ilike.${like},phone.ilike.${like},whatsapp.ilike.${like},email.ilike.${like},document.ilike.${like}`);
        }
        const { data: matches } = await contactQuery;
        scopedContacts = matches || [];
        scopedContactIds = scopedContacts.map((m) => m.id as string);
      }
    }


    const conversationQuery = (limit = loadLimit) => {
      let query = supabase
        .from('service_conversations')
        .select(CONVERSATION_FIELDS)
        .not('contact_id', 'is', null)
        .order('last_message_at', { ascending: false });
      // "Fora da fila" é uma lista deliberada e precisa localizar também
      // conversas antigas; neste escopo pequeno o filtro direto por contato é seguro.
      if (showingOutOfQueue && scopedContactIds?.length) {
        query = query.in('contact_id', scopedContactIds);
      }
      return query.limit(limit);
    };

    if (scopedContactIds?.length === 0) {
      setItems([]);
      hasLoadedInboxRef.current = true;
      setLoading(false);
      return [];
    }

    // O filtro pode conter centenas de contatos. Em vez de enviar todos os
    // UUIDs em um único `in` (que excede o limite da URL), filtramos localmente
    // as conversas recém-carregadas e preservamos os contatos sem conversa.
    const { data: conversations, error } = await conversationQuery(scopedContactIds ? Math.max(loadLimit, 1000) : loadLimit);


    if (error) {
      console.error('Erro ao carregar caixa de entrada:', error);
      toast.error('Não foi possível carregar as conversas.');
      setItems([]);
      setLoading(false);
      return null;
    }

    const scopedContactIdSet = scopedContactIds ? new Set(scopedContactIds) : null;
    const convList = (conversations || []).filter((conversation) => !scopedContactIdSet || scopedContactIdSet.has(conversation.contact_id));

    const conversationContactIds = Array.from(new Set(convList.map((c) => c.contact_id).filter(Boolean))) as string[];
    // Tarefas oficiais são a mesma obrigação exibida no contato e em Tarefas
    // CRM. Carregá-las aqui também cobre conversas resolvidas ou antigas que
    // ficaram fora da página recente da Inbox.
    const { data: scheduledCrmTasks } = await supabase
      .from('tasks')
      .select('contact_id, source, title, scheduled_date, scheduled_time, due_date')
      .in('source', ['crm_next_action', 'crm_reactivation'])
      .is('deleted_at', null)
      .neq('status', 'concluído')
      .not('contact_id', 'is', null);
    // A existência da tarefa oficial independe do vencimento. Isso mantém
    // a obrigação na Inbox quando a IA já a reconhece sem data.
    const officialTasks = indexCrmOperationalTasks(scheduledCrmTasks || []);
    const officialTaskContactIds = new Set<string>();
    const reactivationByContact = new Map<string, string>();
    const nextActionByContact = new Map<string, string>();
    const nextActionTitleByContact = new Map<string, string>();
    for (const [contactId, task] of officialTasks) {
      if (task.hasOfficialNextAction) {
        officialTaskContactIds.add(contactId);
        if (task.nextActionDueAt) nextActionByContact.set(contactId, task.nextActionDueAt);
        if (task.nextActionTitle) nextActionTitleByContact.set(contactId, task.nextActionTitle);
      }
      if (task.reactivationDueAt) reactivationByContact.set(contactId, task.reactivationDueAt);
    }

    const ids = Array.from(new Set([
      ...conversationContactIds,
      ...officialTaskContactIds,
      ...reactivationByContact.keys(),
    ]));
    const { data: contacts } = ids.length
      ? await supabase
          .from('contacts')
          .select(CONTACT_FIELDS)
          .in('id', ids)
      : { data: [] as any[] };
    const contactsById = new Map((contacts || []).map((contact) => [contact.id, contact]));
    const officialNextActionByContact = new Map<string, string>();
    for (const [contactId, taskDueAt] of nextActionByContact) {
      const officialDueAt = getOfficialCrmNextActionAt(taskDueAt);
      if (officialDueAt) officialNextActionByContact.set(contactId, officialDueAt);
    }

    // Pendência de Resultado: o último Resultado canônico já registrado por
    // contato. Reutiliza o histórico existente, sem nova estrutura.
    const lastResultByContact = new Map<string, string>();
    const lastResultCodeByContact = new Map<string, string>();
    const lastHandoffByContact = new Map<string, boolean | null>();
    const lastResultOrderIdByContact = new Map<string, string>();
    const lastReviewedByContact = new Map<string, string>();
    if (ids.length) {
      const { data: resultHistory } = await supabase
        .from('contact_history')
        .select('contact_id,interaction_date,event_code,event_metadata')
        .in('contact_id', ids)
        .not('event_metadata->>result_code', 'is', null)
        .order('interaction_date', { ascending: false })
        .limit(2000);
      const { data: reviewedHistory } = await supabase
        .from('contact_history')
        .select('contact_id,interaction_date')
        .in('contact_id', ids)
        .eq('event_code', 'crm_attendance_no_new_fact')
        .order('interaction_date', { ascending: false })
        .limit(2000);
      for (const row of reviewedHistory || []) {
        const contactId = row.contact_id as string;
        if (contactId && !lastReviewedByContact.has(contactId) && row.interaction_date) {
          lastReviewedByContact.set(contactId, row.interaction_date as string);
        }
      }
      for (const row of resultHistory || []) {
        const contactId = row.contact_id as string;
        if (!contactId || lastResultByContact.has(contactId) || row.event_code === 'stage_changed') continue;
        if (row.interaction_date) lastResultByContact.set(contactId, row.interaction_date as string);
        const metadata = row.event_metadata as { result_code?: string; handoff_required?: boolean; order_id?: string } | null;
        if (metadata?.result_code) lastResultCodeByContact.set(contactId, metadata.result_code);
        lastHandoffByContact.set(contactId, typeof metadata?.handoff_required === 'boolean' ? metadata.handoff_required : null);
        if (typeof metadata?.order_id === 'string' && metadata.order_id.trim()) {
          lastResultOrderIdByContact.set(contactId, metadata.order_id);
        }
      }
    }


    const now = Date.now();
    const seenContacts = new Set<string>();
    const merged: InboxItem[] = [];
    for (const conversation of convList) {
      if (!conversation.contact_id || seenContacts.has(conversation.contact_id)) continue;
      seenContacts.add(conversation.contact_id);
      const contact = contactsById.get(conversation.contact_id);
      if (contact?.is_active === false || !contact?.funnel_status) continue;
      const lastDate = conversation.last_message_at || null;
      const unreadDays = lastDate
        ? Math.floor((now - new Date(lastDate).getTime()) / 86400000)
        : 999;
      merged.push({
        id: conversation.contact_id,
        conversation_id: conversation.id,
        name: contact?.name || conversation.contact_name || 'Sem nome',
        type: contact?.type || null,
        whatsapp: contact?.whatsapp || conversation.contact_handle,
        phone: contact?.phone || null,
        photo_url: contact?.photo_url || conversation.contact_avatar_url,
        funnel_status: normalizeCrmStage(contact.funnel_status),
        temperatura_lead: contact?.temperatura_lead || null,
        ultimo_contato: contact?.ultimo_contato || null,
        last_summary: conversation.last_message_preview || null,
        last_date: lastDate,
        unread_days: unreadDays,
        unread_count: conversation.unread_count,
        needs_reply: conversation.needs_reply,
        attendance_state: conversation.attendance_state,
        channel: conversation.channel || null,
        platform_name: (conversation as any).platform?.name || null,
        platform_icon: (conversation as any).platform?.icon || null,
        assigned_to: conversation.assigned_to,
        status: conversation.status || 'open',
        last_inbound_at: conversation.last_inbound_at,
        last_outbound_at: conversation.last_outbound_at,
        last_message_at: conversation.last_message_at ?? null,
        conversation_updated_at: conversation.updated_at ?? null,
        return_at: conversation.return_at,
        next_action_date: officialNextActionByContact.get(conversation.contact_id) || null,
        next_action_title: nextActionTitleByContact.get(conversation.contact_id) || null,
        official_task_present: officialTaskContactIds.has(conversation.contact_id),
        next_action_text: contact?.next_action_text || null,
        last_result_code: lastResultCodeByContact.get(conversation.contact_id) || null,
        handoff_required: lastHandoffByContact.get(conversation.contact_id) ?? null,
        last_result_order_id: lastResultOrderIdByContact.get(conversation.contact_id) ?? null,
        next_contact_date: null,
        commercial_opt_out: Boolean(contact?.commercial_opt_out),
        reactivation_at: reactivationByContact.get(conversation.contact_id) || null,
        last_result_at: lastResultByContact.get(conversation.contact_id) || null,
        last_no_new_fact_at: lastReviewedByContact.get(conversation.contact_id) || null,
      });
    }

    // Cadastro e CRM são a mesma base: contatos encontrados na busca que ainda
    // não possuem conversa aparecem na fila e criam o atendimento ao abrir.
    for (const contact of scopedContacts) {
      if (seenContacts.has(contact.id)) continue;
      if (!contact.funnel_status) continue;
      seenContacts.add(contact.id);
      merged.push({
        id: contact.id,
        conversation_id: '',
        name: contact.name || 'Sem nome',
        type: contact.type || null,
        whatsapp: contact.whatsapp || null,
        phone: contact.phone || null,
        photo_url: contact.photo_url || null,
        funnel_status: normalizeCrmStage(contact.funnel_status),
        temperatura_lead: contact.temperatura_lead || null,
        ultimo_contato: contact.ultimo_contato || null,
        last_summary: 'Sem conversa registrada — abrir para iniciar atendimento',
        last_date: null,
        unread_days: 999,
        unread_count: 0,
        needs_reply: false,
        attendance_state: null,
        channel: null,
        platform_name: null,
        platform_icon: null,
        assigned_to: null,
        status: 'open',
        last_inbound_at: null,
        last_outbound_at: null,
        last_message_at: null,
        conversation_updated_at: null,
        return_at: null,
        next_action_date: officialNextActionByContact.get(contact.id) || null,
        next_action_title: nextActionTitleByContact.get(contact.id) || null,
        official_task_present: officialTaskContactIds.has(contact.id),
        next_action_text: contact.next_action_text || null,
        last_result_code: lastResultCodeByContact.get(contact.id) || null,
        handoff_required: lastHandoffByContact.get(contact.id) ?? null,
        last_result_order_id: lastResultOrderIdByContact.get(contact.id) ?? null,
        next_contact_date: null,
        commercial_opt_out: Boolean(contact.commercial_opt_out),
        reactivation_at: reactivationByContact.get(contact.id) || null,
        last_result_at: lastResultByContact.get(contact.id) || null,
        last_no_new_fact_at: lastReviewedByContact.get(contact.id) || null,
      });
    }

    // Cliente encerrado também precisa existir na Inbox quando sua obrigação
    // CRM vencer, mesmo que a conversa antiga não esteja entre as recentes.
    const scheduledContactIds = new Set([
      ...officialNextActionByContact.keys(),
      ...reactivationByContact.keys(),
    ]);
    for (const contactId of scheduledContactIds) {
      if (seenContacts.has(contactId)) continue;
      const contact = contactsById.get(contactId);
      if (!contact || contact.is_active === false) continue;
      seenContacts.add(contactId);
      merged.push({
        id: contactId,
        conversation_id: '',
        name: contact.name || 'Sem nome',
        type: contact.type || null,
        whatsapp: contact.whatsapp || null,
        phone: contact.phone || null,
        photo_url: contact.photo_url || null,
        funnel_status: normalizeCrmStage(contact.funnel_status),
        temperatura_lead: contact.temperatura_lead || null,
        ultimo_contato: contact.ultimo_contato || null,
        last_summary: reactivationByContact.has(contactId)
          ? 'Reativação comercial programada'
          : 'Próxima ação CRM programada',
        last_date: null,
        unread_days: 0,
        unread_count: 0,
        needs_reply: false,
        attendance_state: 'concluido',
        channel: null,
        platform_name: null,
        platform_icon: null,
        assigned_to: null,
        status: 'resolved',
        last_inbound_at: null,
        last_outbound_at: null,
        last_message_at: null,
        conversation_updated_at: null,
        return_at: null,
        next_action_date: officialNextActionByContact.get(contactId) || null,
        next_action_title: nextActionTitleByContact.get(contactId) || null,
        official_task_present: officialTaskContactIds.has(contactId),
        next_action_text: contact.next_action_text || null,
        last_result_code: lastResultCodeByContact.get(contactId) || null,
        handoff_required: lastHandoffByContact.get(contactId) ?? null,
        last_result_order_id: lastResultOrderIdByContact.get(contactId) ?? null,
        next_contact_date: null,
        commercial_opt_out: Boolean(contact.commercial_opt_out),
        reactivation_at: reactivationByContact.get(contactId) || null,
        last_result_at: lastResultByContact.get(contactId) || null,
        last_no_new_fact_at: lastReviewedByContact.get(contactId) || null,
      });
    }

    setItems(merged);
    hasLoadedInboxRef.current = true;
    setLoading(false);
    return merged;

  }, [loadLimit, deferredSearch, stageFilter, showingOutOfQueue, assignments, outOfQueueTag?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: nova mensagem atualiza preview/ordenação sem recarregar a página
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        load();
      }, 600);
    };
    const channel = supabase
      .channel('crm-inbox-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_messages' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_conversations' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, refresh)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [load]);

  useEffect(() => {
    const contactId = searchParams.get('contact');
    // E-02: receber ?contact=ID sozinho é navegação passiva. Só attend=1
    // autoriza iniciar, atribuir ou reabrir uma conversa por deep-link.
    if (!isExplicitCrmAttendanceLink(searchParams) || !contactId || deepLinkHandled.current === contactId || !isLinked || !activeUserId) return;
    // E-03.2: não gravar outro atendimento por deep-link com ações pendentes.
    if (!guardContactSwitch(contactId)) return;
    deepLinkHandled.current = contactId;

    const openAttendance = async () => {
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('id,name,whatsapp,phone,mobile,photo_url,funnel_status')
        .eq('id', contactId)
        .maybeSingle();
      if (contactError || !contact) {
        toast.error('Contato não encontrado.');
        return;
      }

      // Apenas abrir a Inbox com ?contact=ID&attend=1 é ação comercial explícita.
      // Promote only then; passive financial/operational registrations stay out.
      if (!contact.funnel_status) {
        const { error: stageError } = await supabase
          .from('contacts')
          .update({ funnel_status: 'novo_lead', updated_at: new Date().toISOString() })
          .eq('id', contact.id);
        if (stageError) {
          toast.error('Não foi possível iniciar o contato no CRM.');
          return;
        }
        contact.funnel_status = 'novo_lead';
      }

      const { data: existing } = await supabase
        .from('service_conversations')
        .select('id')
        .eq('contact_id', contactId)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const phone = contact.whatsapp || contact.mobile || contact.phone || null;
      const operationalState = {
        assigned_to: activeUserId,
        attendance_state: 'em_atendimento',
        status: 'open',
        resolved_at: null,
        unread_count: 0,
      };
      const result = existing
        ? await supabase.from('service_conversations').update(operationalState).eq('id', existing.id)
        : await supabase.from('service_conversations').insert({
            contact_id: contact.id,
            contact_name: contact.name,
            contact_handle: phone,
            contact_avatar_url: contact.photo_url,
            funnel_stage: normalizeCrmStage(contact.funnel_status),
            channel: 'whatsapp',
            needs_reply: false,
            ...operationalState,
          });

      if (result.error) {
        toast.error('Não foi possível iniciar o atendimento.');
        return;
      }
      await load();
      guardedSelectContact(contactId);
      setSearchParams({}, { replace: true });
    };

    void openAttendance();
  }, [activeUserId, isLinked, load, searchParams, setSearchParams, guardContactSwitch]);


  const taggedContactIds = useMemo(() => {
    if (tagFilter === 'all') return null;
    return new Set(assignments.filter((a) => a.tag_id === tagFilter).map((a) => a.contact_id));
  }, [assignments, tagFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    const searching = q.length > 0 || stageFilter !== 'all';
    return items.filter((i) => {
      const matchesSearch = !q ||
        i.name.toLowerCase().includes(q) ||
        (i.whatsapp || '').includes(q) ||
        (i.phone || '').includes(q) ||
        (i.last_summary || '').toLowerCase().includes(q);
      if (!matchesSearch && !searching) return false;
      const isOutOfQueue = outOfQueueContactIds.has(i.id);
      if (showingOutOfQueue) {
        if (!isOutOfQueue) return false;
        if (stageFilter !== 'all' && i.funnel_status !== stageFilter) return false;
        if (assignmentFilter === 'unassigned' && i.assigned_to) return false;
        if (assignmentFilter === 'assigned' && !i.assigned_to) return false;
        return true;
      }
      if (isOutOfQueue) return false;
      if (taggedContactIds && !taggedContactIds.has(i.id)) return false;
      if (stageFilter !== 'all' && i.funnel_status !== stageFilter) return false;
      if (assignmentFilter === 'unassigned' && i.assigned_to) return false;
      if (assignmentFilter === 'assigned' && !i.assigned_to) return false;
      // Resolvidas não fazem parte da fila operacional; retornos legítimos
      // continuam acessíveis em "Hoje" enquanto tiverem return_at.
      const priority = getCrmPriority(toCrmPriorityInput(i), now);
      // "Aguardando cliente" = bola com o cliente. Aceita todos os aliases
      // equivalentes já existentes e exclui quem exige ação nossa agora
      // (inbound novo, retorno/obrigação vencida, Resultado pendente).
      if (waitingCustomerOnly) {
        if (!isWaitingCustomerState(i.attendance_state)) return false;
        if (priority.operational) return false;
      }
      const supplier = isPureSupplier(i);
      // Na busca/estágio o cadastro inteiro fica visível (cliente ou fornecedor).
      if (!searching) {
        if (conversationScope === 'commercial') {
          if (supplier && !['P0', 'P1'].includes(priority.level)) return false;
        } else if (!supplier) {
          return false;
        }
      }


      // Buscando por nome/estágio, o lead sempre aparece: os chips de
      // prioridade organizam a fila, mas não podem esconder um lead existente.
      if (searching) return true;
      if (inboxFilter === 'priority') return priority.operational;
      if (inboxFilter === 'needs_reply') return priority.reason === 'needs_reply';
      if (inboxFilter === 'today') return ['return_today', 'next_action_today', 'reactivation_today'].includes(priority.reason);
      if (inboxFilter === 'overdue') return ['return_overdue', 'next_action_overdue', 'reactivation_overdue'].includes(priority.reason);
      return priority.reason === 'cooling';

    });
  }, [items, search, inboxFilter, taggedContactIds, stageFilter, assignmentFilter, waitingCustomerOnly, conversationScope, outOfQueueContactIds, showingOutOfQueue]);

  // A prioridade é somente uma camada de apresentação: os filtros continuam
  // definindo quem entra na fila e a regra pura explica a ordem resultante.
  const prioritized = useMemo(() => {
    const now = new Date();
    return [...filtered]
      .map((item) => ({ item, priority: projectCrmOperationalState(toCrmOperationalSource(item), now).priority }))
      .sort((a, b) => compareCrmPriority(toCrmPriorityInput(a.item), toCrmPriorityInput(b.item), now));
  }, [filtered]);


  const selected = items.find((i) => i.id === selectedId) || null;
  const selectedIsOutOfQueue = Boolean(selected && outOfQueueContactIds.has(selected.id));
  // F2-A: a mesma projeção F1-A da fila, sem writer, ação ou nova prioridade.
  const selectedOrientation = selected
    ? getCrmInboxOrientation(projectCrmOperationalState(toCrmOperationalSource(selected)))
    : null;
  const orientationShortcut = selectedOrientation ? getCrmOrientationShortcut(selectedOrientation) : null;
  // F4-A: consulta pontual pelo ID EXPLÍCITO do último Resultado. Não se
  // procura Pedido por nome, por data ou por simples histórico do contato.
  const [handoffLookup, setHandoffLookup] = useState<{
    contextKey: string;
    lookup: CrmOrderLookup;
    order: CrmReferencedOrder | null;
  } | null>(null);
  const selectedHandoffKey = selected
    ? [selected.id, selected.conversation_id ?? '', selected.last_result_at ?? '',
      selected.last_result_code ?? '', selected.last_result_order_id ?? ''].join('|')
    : '';
  useEffect(() => {
    const orderId = selected?.last_result_order_id;
    const contactId = selected?.id;
    const contextKey = selectedHandoffKey;
    setHandoffLookup(null);
    if (!orderId || !contactId) return;
    let cancelled = false;
    // Verificação simples evita passar valores inválidos ao filtro UUID da DB.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
      setHandoffLookup({ contextKey, lookup: 'missing', order: null });
      return;
    }
    setHandoffLookup({ contextKey, lookup: 'loading', order: null });
    void supabase.from('orders')
      .select('id,contact_id,order_number,sale_origin,operational_status')
      .eq('id', orderId)
      .eq('contact_id', contactId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setHandoffLookup({
          contextKey,
          lookup: error ? 'error' : data ? 'found' : 'missing',
          order: error ? null : (data as CrmReferencedOrder | null),
        });
      });
    return () => { cancelled = true; };
  }, [selected?.id, selected?.conversation_id, selected?.last_result_at,
      selected?.last_result_code, selected?.last_result_order_id]);
  const handoffEvidence = selected ? evaluateCrmHandoffEvidence({
    contactId: selected.id,
    handoffRequired: selected.handoff_required,
    referencedOrderId: selected.last_result_order_id,
    lookup: handoffLookup?.contextKey === selectedHandoffKey
      ? handoffLookup.lookup : 'not_requested',
    order: handoffLookup?.contextKey === selectedHandoffKey ? handoffLookup.order : null,
  }) : null;
  // F4-B: só consulta Separação após a F4-A comprovar ID do Pedido e contato.
  // F4-C.2: a primeira ação registrada com operador faz a assunção no fluxo,
  // sem clique adicional e sem alegar aceite formal independente.
  const [separationLookup, setSeparationLookup] = useState<{
    contextKey: string;
    lookup: CrmSeparationLookup;
    separation: CrmOrderSeparationEvidenceRow | null;
  } | null>(null);
  const verifiedOrderId = handoffEvidence?.explicitOrderLinkVerified
    && handoffEvidence.state === 'linked_order' ? handoffEvidence.orderId : null;
  useEffect(() => {
    const contextKey = selectedHandoffKey;
    setSeparationLookup(null);
    if (!verifiedOrderId) return;
    let cancelled = false;
    setSeparationLookup({ contextKey, lookup: 'loading', separation: null });
    void supabase.from('order_separation')
      .select('order_id,separation_status,created_at,first_printed_at,first_printed_by,finalized_at,finalized_by')
      .eq('order_id', verifiedOrderId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setSeparationLookup({
          contextKey,
          lookup: error ? 'error' : data ? 'found' : 'missing',
          separation: error ? null : data as CrmOrderSeparationEvidenceRow | null,
        });
      });
    return () => { cancelled = true; };
  }, [selectedHandoffKey, verifiedOrderId]);
  const handoffQueueEvidence = handoffEvidence
    ? evaluateCrmHandoffQueueEvidence({
        orderLink: handoffEvidence,
        lookup: separationLookup?.contextKey === selectedHandoffKey
          ? separationLookup.lookup : 'not_requested',
        separation: separationLookup?.contextKey === selectedHandoffKey
          ? separationLookup.separation : null,
      })
    : null;
  const operationalActionEvidence = handoffEvidence
    ? evaluateCrmOperationalActionEvidence({
        orderLink: handoffEvidence,
        lookup: separationLookup?.contextKey === selectedHandoffKey
          ? separationLookup.lookup : 'not_requested',
        separation: separationLookup?.contextKey === selectedHandoffKey
          ? separationLookup.separation : null,
      })
    : null;
  // Dono visual das operações assíncronas do atendimento. Uma operação pode
  // terminar depois da troca de contato, mas nunca pode atualizar o novo painel.
  const selectedContextRef = useRef<string>('');
  useEffect(() => {
    selectedContextRef.current = selected ? `${selected.id}|${selected.conversation_id ?? ''}` : '';
  }, [selected?.id, selected?.conversation_id]);

  const prepareOrientationShortcut = () => {
    if (!selected || !selectedOrientation) return;
    const key = `${selected.id}|${selected.conversation_id ?? ''}`;
    if (selectedContextRef.current !== key) return;
    const preparation = prepareCrmSupervisedAction(selectedOrientation, orientationShortcut, {
      contactId: selected.id,
      conversationId: selected.conversation_id ?? null,
      busy: attendanceBusy,
    });
    if (preparation.status === 'blocked') {
      toast.message(preparation.reason);
      return;
    }
    // Toda execução segue pertencendo aos controles já existentes.
    const id = ++actionRequestSequenceRef.current;
    if (preparation.target === 'history') {
      setDetailTab('historico');
    } else if (preparation.target === 'result') {
      setDetailTab('conversa');
      setAttendanceActionRequest({ mode: 'outcome', id, contextKey: key });
    } else if (preparation.target === 'reply') {
      setDetailTab('conversa');
      setReplyFocusRequest({
        id, contactId: preparation.contactId, conversationId: preparation.conversationId,
        prepareAssistant: preparation.analyzeReply,
      });
      if (!preparation.analyzeReply) toast.message(preparation.reason);
    }
  };

  // FRENTE 3.5 — contexto (somente leitura) da campanha que originou o contato.
  const [campaignContext, setCampaignContext] = useState<CampaignContext | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!selected?.id) { setCampaignContext(null); return; }
    void resolveCampaignContext({
      contactId: selected.id,
      conversationId: selected.conversation_id || null,
      lastInboundAt: selected.last_inbound_at,
    }).then((ctx) => { if (!cancelled) setCampaignContext(ctx); });
    return () => { cancelled = true; };
  }, [selected?.id, selected?.conversation_id, selected?.last_inbound_at]);

  const openConversation = async (item: InboxItem, fromActiveOperation = false) => {
    // Validar a troca antes de qualquer insert/update de conversa.
    if (!guardContactSwitch(item.id, fromActiveOperation)) return;
    if (!fromActiveOperation && attendanceWriteGateRef.current.locked()) {
      toast.warning('Aguarde a gravação do atendimento antes de abrir outro contato.');
      return;
    }
    if (!guardProfileExit()) return;
    // Contato sem conversa: cria o atendimento na hora para não existir cadastro
    // "invisível" na caixa de entrada.
    if (!item.conversation_id) {
      const { data: created, error } = await supabase
        .from('service_conversations')
        .insert({
          contact_id: item.id,
          contact_name: item.name,
          contact_handle: item.whatsapp || item.phone,
          contact_avatar_url: item.photo_url,
          funnel_stage: item.funnel_status,
          channel: 'whatsapp',
          status: 'open',
          needs_reply: false,
          unread_count: 0,
        })
        .select('id')
        .maybeSingle();
      if (error || !created) {
        toast.error('Não foi possível abrir o atendimento deste contato.');
        return;
      }
      setItems(current => current.map(row => row.id === item.id ? { ...row, conversation_id: created.id } : row));
      guardedSelectContact(item.id, fromActiveOperation);
      return;
    }
    guardedSelectContact(item.id, fromActiveOperation);
    const priority = getCrmPriority(toCrmPriorityInput(item), new Date());
    if (item.status === 'resolved' && [
      'reactivation_overdue',
      'reactivation_today',
      'next_action_overdue',
      'next_action_today',
    ].includes(priority.reason)) {
      const { error } = await supabase.from('service_conversations').update({
        status: 'open',
        resolved_at: null,
        attendance_state: 'em_atendimento',
        needs_reply: false,
        unread_count: 0,
      }).eq('id', item.conversation_id);
      if (error) {
        toast.error('Não foi possível iniciar a reativação comercial.');
        return;
      }
      setItems(current => current.map(row => row.id === item.id ? { ...row, status: 'open', attendance_state: 'em_atendimento' } : row));
    }
    if (item.unread_count > 0) {
      setItems(current => current.map(row => row.id === item.id ? { ...row, unread_count: 0 } : row));
      await supabase.from('service_conversations').update({ unread_count: 0 }).eq('id', item.conversation_id);
    }
  };


  const ensureOutOfQueueTag = async () => {
    if (outOfQueueTag) return outOfQueueTag.id;
    const { data: existing, error: lookupError } = await supabase
      .from('contact_tags')
      .select('id')
      .ilike('name', OUT_OF_QUEUE_TAG_NAME)
      .limit(1)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing?.id) {
      await fetchTags();
      return existing.id as string;
    }
    const { data: created, error: createError } = await supabase
      .from('contact_tags')
      .insert({ name: OUT_OF_QUEUE_TAG_NAME, color: OUT_OF_QUEUE_TAG_COLOR })
      .select('id')
      .single();
    if (createError) throw createError;
    await fetchTags();
    return created.id as string;
  };

  const toggleSelectedOutOfQueue = async () => {
    if (!selected || !beginAttendanceOperation()) return;
    const currentContactId = selected.id;
    const fallbackNext = prioritized.find(({ item }) => item.id !== currentContactId)?.item ?? null;
    try {
      if (selectedIsOutOfQueue) {
        if (!outOfQueueTag) return;
        const { error } = await supabase
          .from('contact_tag_assignments')
          .delete()
          .eq('contact_id', currentContactId)
          .eq('tag_id', outOfQueueTag.id);
        if (error) throw error;
        await fetchTags();
        guardedSelectContact(fallbackNext?.id ?? null, true);
        toast.success('Contato voltou para a fila.');
        return;
      }

      const tagId = await ensureOutOfQueueTag();
      const { error } = await supabase
        .from('contact_tag_assignments')
        .insert({ contact_id: currentContactId, tag_id: tagId });
      if (error && error.code !== '23505') throw error;
      await fetchTags();
      guardedSelectContact(fallbackNext?.id ?? null, true);
      toast.success('Contato retirado da fila. Conversas e histórico foram preservados.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível atualizar a visibilidade deste contato na fila.');
    } finally {
      finishAttendanceOperation();
    }
  };

  const updateAttendance = async (patch: Record<string, unknown>, successMessage: string) => {
    if (!selected) return;
    const { id: contactId, conversation_id: conversationId } = selected;
    if (!conversationId) {
      toast.error('Este contato ainda não possui uma conversa operacional para atualizar.');
      return;
    }
    if (!beginAttendanceOperation()) return;
    try {
      const { data, error } = await supabase.from('service_conversations')
        .update(patch).eq('id', conversationId).eq('contact_id', contactId).select('id').maybeSingle();
      if (error) throw error;
      if (!isConfirmedAttendanceMutation(data, conversationId)) {
        toast.error('Nenhuma conversa foi atualizada. Reabra o atendimento antes de tentar novamente.');
        return;
      }
      toast.success(successMessage);
      await load();
    } catch (error) {
      console.error('CRM D-01: updateAttendance', error);
      toast.error('Não foi possível atualizar o atendimento.');
    } finally {
      finishAttendanceOperation();
    }
  };

  // D-03: sem novo writer. Avisar antes de concluir apenas quando há pendência.
  const concludeSelectedConversation = () => {
    if (!selected) return;
    void updateAttendance({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      attendance_state: 'concluido',
      needs_reply: false,
      unread_count: 0,
    }, 'Atendimento concluído.');
  };
  const requestConcludeSelectedConversation = () => {
    if (!selected || !guardProfileExit()) return;
    const warning = getConcludeAttendanceWarning({
      pendingResult: getCrmPriority(toCrmPriorityInput(selected)).reason === 'pending_result',
      officialTaskPresent: selected.official_task_present,
      operationalReturnScheduled: Boolean(selected.return_at),
    });
    if (warning) {
      setConcludeIntent({ contactId: selected.id, conversationId: selected.conversation_id, warning });
    } else {
      concludeSelectedConversation();
    }
  };

  const updateSelectedPhoto = async (photoUrl: string | null) => {
    if (!selected) return;
    try {
      const [{ error: contactError }, { error: conversationError }] = await Promise.all([
        supabase.from('contacts').update({ photo_url: photoUrl, updated_at: new Date().toISOString() }).eq('id', selected.id),
        supabase.from('service_conversations').update({ contact_avatar_url: photoUrl }).eq('contact_id', selected.id),
      ]);
      if (contactError || conversationError) throw contactError || conversationError;
      setItems(current => current.map(item => item.id === selected.id ? { ...item, photo_url: photoUrl } : item));
      setLeadContact(current => current ? { ...current, photo_url: photoUrl || undefined } : current);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível atualizar a foto do lead.');
    }
  };



  const archiveSelectedConversation = async () => {
    if (!selected) return;
    if (!selected.conversation_id) { toast.error('Conversa operacional inexistente; nada foi arquivado.'); return; }
    if (!guardProfileExit()) return;
    const confirmed = window.confirm(`Arquivar esta conversa de "${selected.name}"?\n\n${getArchiveAttendanceWarning({ officialTaskPresent: selected.official_task_present })}`);
    if (!confirmed || !beginAttendanceOperation()) return;
    // C2: captura o próximo item visível/priorizado antes de arquivar, para
    // manter a continuidade operacional sem criar nova regra de prioridade.
    const currentContactId = selected.id;
    const fallbackNextId = prioritized.find(({ item }) => item.id !== currentContactId)?.item.id ?? null;
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase.from('service_conversations').update({
        status: 'resolved',
        resolved_at: now,
        attendance_state: 'concluido',
        needs_reply: false,
        unread_count: 0,
        return_at: null,
      }).eq('id', selected.conversation_id).eq('contact_id', currentContactId).select('id').maybeSingle();
      if (error) throw error;
      if (!isConfirmedAttendanceMutation(data, selected.conversation_id)) {
        toast.error('A conversa não foi atualizada; o arquivamento não foi confirmado.');
        return;
      }
      setLeadPanelOpen(false);
      setMobileProfileOpen(false);
      const refreshedItems = await load();
      if (refreshedItems === null) {
        guardedSelectContact(null, true);
        toast.success('Conversa arquivada. O contato e o histórico foram preservados.');
        return;
      }
      let next: InboxItem | undefined;
      if (attendanceQueueScope.length > 0) {
        const scope = new Set(attendanceQueueScope);
        const nowDate = new Date();
        next = refreshedItems
          .filter((item) => scope.has(item.id) && item.id !== currentContactId && !outOfQueueContactIds.has(item.id) && getCrmPriority(toCrmPriorityInput(item), nowDate).operational)
          .sort((a, b) => compareCrmPriority(toCrmPriorityInput(a), toCrmPriorityInput(b), nowDate))[0];
        if (!next) {
          setAttendanceQueueScope([]);
          sessionStorage.removeItem('crm-attendance-queue');
        }
      } else if (fallbackNextId) {
        next = refreshedItems.find((item) => item.id === fallbackNextId);
      }
      if (next) {
        await openConversation(next, true);
      } else {
        guardedSelectContact(null, true);
      }
      toast.success('Conversa arquivada. O contato e o histórico foram preservados.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível arquivar a conversa.');
    } finally { finishAttendanceOperation(); }
  };

  const attendanceQueue = useMemo(() => {
    if (attendanceQueueScope.length === 0) return [];
    const scope = new Set(attendanceQueueScope);
    const now = new Date();
    return items
      .filter((item) => scope.has(item.id) && !outOfQueueContactIds.has(item.id) && getCrmPriority(toCrmPriorityInput(item), now).operational)
      .sort((a, b) => compareCrmPriority(toCrmPriorityInput(a), toCrmPriorityInput(b), now));
  }, [attendanceQueueScope, items, outOfQueueContactIds]);

  const concludeAttendanceQueue = () => {
    setAttendanceQueueScope([]);
    sessionStorage.removeItem('crm-attendance-queue');
    toast.success('Fila de hoje concluída.');
  };

  const nextAttendance = async (refreshedItems?: InboxItem[] | null, fromActiveOperation = false) => {
    if (!selected || attendanceQueueScope.length === 0) return;
    if (attendanceWriteGateRef.current.locked() && !fromActiveOperation) {
      toast.warning('Aguarde a gravação antes de avançar na fila.');
      return;
    }

    // A lista salva apenas delimita o escopo inicial. A decisão é feita com os
    // dados recém-carregados, para não reabrir atendimento já concluído ou adiado.
    // Quem já executou load() (ex: após registrar Resultado) pode reutilizar os
    // dados e evitar uma segunda recarga completa consecutiva.
    const itemsToUse = refreshedItems !== undefined ? refreshedItems : await load();
    if (itemsToUse === null) return;
    const scope = new Set(attendanceQueueScope);
    const now = new Date();
    const next = itemsToUse
      .filter((item) => scope.has(item.id) && item.id !== selected.id && !outOfQueueContactIds.has(item.id) && getCrmPriority(toCrmPriorityInput(item), now).operational)
      .sort((a, b) => compareCrmPriority(toCrmPriorityInput(a), toCrmPriorityInput(b), now))[0];

    if (!next) {
      concludeAttendanceQueue();
      return;
    }

    await openConversation(next, fromActiveOperation);
  };

  const registerOutcome = async (resultCode: CrmResultCode, scheduledFor?: string | null, contextKey?: string, selectionOrigin?: CrmResultSelectionOrigin) => {
    if (!selected) return;
    // CRM-COR-04: trava de integridade — o formulário precisa pertencer ao atendimento atual.
    const currentContextKey = `${selected.id}|${selected.conversation_id ?? ''}`;
    if (contextKey && contextKey !== currentContextKey) {
      setSuggestedResultCode(null);
      toast.error('Contato alterado durante o registro. Selecione o resultado novamente.');
      return;
    }
    const operationContextKey = currentContextKey;
    if (!beginAttendanceOperation(true)) return;
    try {
      const result = await applyCanonicalAttendanceResult({ contactId: selected.id, conversationId: selected.conversation_id, resultCode, scheduledFor, selectionOrigin });
      // A gravação pertence ao contato capturado acima. Depois dela, só efeitos
      // visuais pertencentes ao mesmo contexto podem tocar a Inbox atual.
      if (selectedContextRef.current !== operationContextKey) return;
      const stageSummary = result.stage.action === 'MOVE'
        ? `Etapa: ${getCrmStageLabel(result.stage.previousStage)} → ${getCrmStageLabel(result.stage.nextStage)}`
        : `Etapa: ${getCrmStageLabel(result.stage.previousStage)} — mantida`;
      const nextActionSummary = result.nextActionLabel
        ? `Próxima ação: ${result.nextActionLabel}${formatCrmResultNextActionDate(result.nextActionDate, scheduledFor)}`
        : 'Próxima ação: nenhuma ação comercial';
      const conversationSummary = result.conversationResolved ? 'Conversa encerrada' : 'Conversa mantida aberta';
      toast.success('Resultado registrado', { description: `${result.label} · ${stageSummary} · ${nextActionSummary} · ${conversationSummary}` });
      setSendConfirmation(false);
      setOperationalHandoff(result.handoffPending ? { resultCode, label: result.label } : null);
      const refreshedItems = await load();
      if (refreshedItems === null) return;
      if (attendanceQueueScope.length > 0) await nextAttendance(refreshedItems, true);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível registrar o resultado do atendimento.');
    } finally {
      finishAttendanceOperation();
    }
  };

  // Revisão humana sem novo Resultado: não altera tarefas, etapa nem fatos canônicos.
  const acknowledgeNoNewFact = async () => {
    if (!selected || attendanceBusy) return;
    const current = selected;
    const priority = getCrmPriority(toCrmPriorityInput(current));
    const lastInbound = current.last_inbound_at ? Date.parse(current.last_inbound_at) : NaN;
    const lastOutbound = current.last_outbound_at ? Date.parse(current.last_outbound_at) : NaN;
    if (priority.reason !== 'pending_result' || !current.last_result_at
      || !isWaitingCustomerState(current.attendance_state) || current.needs_reply
      || !(lastOutbound >= lastInbound)
      || (current.next_action_date && Date.parse(current.next_action_date) <= Date.now())) {
      toast.error('Ainda existe uma obrigação ou mensagem que precisa ser tratada pelo Resultado.');
      return;
    }
    if (!beginAttendanceOperation(true)) return;
    try {
      const { data: latest, error: readError } = await supabase.from('service_conversations')
        .select('last_inbound_at,last_outbound_at,needs_reply,attendance_state')
        .eq('id', current.conversation_id).single();
      if (readError) throw readError;
      if (latest?.last_inbound_at !== current.last_inbound_at
        || latest?.last_outbound_at !== current.last_outbound_at
        || latest?.needs_reply !== false
        || !isWaitingCustomerState(latest?.attendance_state)) {
        toast.error('O atendimento mudou. Atualize a fila antes de revisar.');
        await load();
        return;
      }
      const { error } = await supabase.from('contact_history').insert({
        contact_id: current.id,
        event_type: 'contact',
        event_code: 'crm_attendance_no_new_fact',
        description: 'Atendimento revisado pelo operador: nenhuma mudança comercial nova a registrar.',
        interaction_date: new Date().toISOString(),
        event_metadata: { source: 'crm_inbox', conversation_id: current.conversation_id },
      } as any);
      if (error) throw error;
      toast.success('Revisão registrada. Nenhum Resultado foi criado.');
      await load();
    } catch (error) {
      console.error('CRM revisão sem fato novo:', error);
      toast.error('Não foi possível registrar a revisão do atendimento.');
    } finally {
      finishAttendanceOperation();
    }
  };

  const snoozeSelected = async (when: number | string) => {
    if (!selected || !beginAttendanceOperation(true)) return;
    try {
      await snoozeAttendance({ contactId: selected.id, conversationId: selected.conversation_id, when });
      toast.success('Atendimento adiado e próxima ação atualizada.');
      setSendConfirmation(false);
      await nextAttendance(undefined, true);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível adiar o atendimento.');
    } finally { finishAttendanceOperation(); }
  };

  const concludeSaleAttendance = async () => {
    if (!selected || !beginAttendanceOperation(true)) return;
    setSaleDecisionBusy(true);
    try {
      const result = await applyAttendanceOutcome({
        contactId: selected.id,
        conversationId: selected.conversation_id,
        outcome: 'sale_closed',
        saleAlreadyRecorded: true,
      });
      toast.success(`${result.label} · pós-venda agendado.`);
      setSendConfirmation(false);
      setSaleDecisionOpen(false);
      await load();
    } catch (error) {
      console.error(error);
      toast.error('A venda foi registrada, mas não foi possível concluir o atendimento. Tente novamente ou mantenha a conversa aberta.');
    } finally {
      setSaleDecisionBusy(false);
      finishAttendanceOperation();
    }
  };

  const handleSummarize = async (contactId: string) => {
    setSummaryLoading(true);
    setSummary('');
    setSummaryOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke('contact-summary', {
        body: { contact_id: contactId },
      });
      if (error) throw error;
      const result = data as { error?: string; summary?: string } | null;
      if (result?.error) {
        toast.error(result.error);
        setSummaryOpen(false);
        return;
      }
      setSummary(result?.summary || 'Sem resumo gerado.');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar resumo. Verifique seus créditos de IA.');
      setSummaryOpen(false);
    } finally {
      setSummaryLoading(false);
    }
  };

  const formatLastDate = (d: string | null) => {
    if (!d) return 'Sem interações';
    try {
      return formatDistanceToNow(parseISO(d), { addSuffix: true, locale: ptBR });
    } catch {
      return d;
    }
  };

  // A3.1-A02: estado puramente visual; não altera o predicado da fila.
  const isConsultingAllContacts = Boolean(search.trim()) || stageFilter !== 'all';
  const activeDetailedFilters = Number(stageFilter !== 'all')
    + Number(assignmentFilter !== 'all') + Number(waitingCustomerOnly)
    + Number(tagFilter !== 'all') + Number(inboxFilter === 'cooling');

  return (
    <div className="h-[calc(100dvh-var(--footer-effective-h,0px))] min-h-[560px] overflow-hidden bg-background flex flex-col">
      {/* A3.1 — faixa única: somente apresentação; filtros e callbacks preservados. */}
      <div className="z-30 shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain whitespace-nowrap px-3 py-2 [scrollbar-width:thin]" aria-label="Controles da Caixa de Entrada; role horizontalmente para acessar todas as opções">
          <Link to="/contatos" className="shrink-0" onClick={(event) => { if (!guardProfileExit()) event.preventDefault(); }}>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5" title="Voltar à Gestão">
              <ArrowLeft className="h-4 w-4" /><span>Gestão</span>
            </Button>
          </Link>
          <h1 className="shrink-0 text-sm font-semibold">Inbox</h1>
          {!selected && (
            <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 text-xs md:hidden"
              onClick={() => setMobileStartVisible(value => !value)}>
              {mobileStartVisible ? 'Ver fila' : 'Start — Oportunidades'}
            </Button>
          )}
          {isConsultingAllContacts && (
            <Badge variant="outline" className="h-7 shrink-0 border-amber-500/60 bg-amber-500/10 px-2 text-[10px]"
              title="A busca e a etapa consultam contatos além da fila operacional e do escopo selecionado">
              Consulta geral
            </Badge>
          )}
          <div className="relative w-[clamp(150px,20vw,300px)] shrink-0">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Buscar contato ou conversa"
              placeholder="Buscar contato ou conversa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
          {([
            ['priority', 'Prioridade'],
            ['needs_reply', 'Responder'],
            ['today', 'Hoje'],
            ['overdue', 'Atrasados'],
          ] as Array<[InboxFilter, string]>).map(([key, label]) => (
            <Button key={key} size="sm" variant={inboxFilter === key ? 'default' : 'outline'}
              className="h-8 shrink-0 px-2.5 text-xs" onClick={() => setInboxFilter(key)}>
              {label}
            </Button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant={inboxFilter === 'cooling' ? 'secondary' : 'outline'}
                className="h-8 shrink-0 gap-1.5 px-2.5 text-xs" aria-label="Filtros adicionais">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros
                {activeDetailedFilters > 0 && (
                  <span aria-label={String(activeDetailedFilters) + ' filtros detalhados ativos'}
                    className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                    {activeDetailedFilters}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="w-[min(340px,calc(100vw-1rem))] max-h-[min(75vh,550px)] overflow-y-auto p-3">
              <div className="space-y-3">
                <div className="text-xs font-semibold">Filtros adicionais</div>
                <Button size="sm" variant={inboxFilter === 'cooling' ? 'secondary' : 'outline'}
                  className="w-full justify-start text-xs" onClick={() => setInboxFilter('cooling')}>
                  Esfriando
                </Button>
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="h-9 w-full text-xs"><SelectValue placeholder="Etapa comercial" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Todas as etapas</SelectItem>
                    {[
                      ['novo_lead', 'Novo Lead'], ['contato_realizado', 'Contato Realizado'],
                      ['proposta_enviada', 'Proposta Enviada'], ['negociacao', 'Negociação'],
                      ['fechado', 'Fechado'], ['pos_venda', 'Pós-Venda'],
                      ['cadencia', 'Cadência'], ['perdido', 'Perdido'],
                    ].map(([value, label]) => <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={assignmentFilter} onValueChange={(value) => setAssignmentFilter(value as AssignmentFilter)}>
                  <SelectTrigger className="h-9 w-full text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Responsável: todos</SelectItem>
                    <SelectItem value="assigned" className="text-xs">Com responsável</SelectItem>
                    <SelectItem value="unassigned" className="text-xs">Sem responsável</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant={waitingCustomerOnly ? 'secondary' : 'outline'}
                  className="w-full justify-start text-xs"
                  onClick={() => setWaitingCustomerOnly((value) => !value)}>Aguardando cliente</Button>
                <Select value={tagFilter} onValueChange={setTagFilter}>
                  <SelectTrigger className="h-9 w-full text-xs">
                    <div className="flex items-center gap-1 truncate"><Tag className="h-3 w-3" /><SelectValue placeholder="Tag" /></div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Todas as tags</SelectItem>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id} className="text-xs">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />{tag.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeDetailedFilters > 0 && (
                  <Button type="button" variant="ghost" size="sm" className="w-full justify-start text-xs"
                    onClick={() => {
                      setStageFilter('all');
                      setAssignmentFilter('all');
                      setWaitingCustomerOnly(false);
                      setTagFilter('all');
                      if (inboxFilter === 'cooling') setInboxFilter('priority');
                    }}>
                    Limpar filtros detalhados
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <Select value={conversationScope} onValueChange={(value) => setConversationScope(value as ConversationScope)}>
            <SelectTrigger className="h-8 w-[150px] shrink-0 text-xs" aria-label="Escopo da consulta"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="commercial" className="text-xs">Comercial</SelectItem>
              <SelectItem value="suppliers" className="text-xs">Fornecedores / outras</SelectItem>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 shrink-0 gap-1.5 text-xs">
                <MoreHorizontal className="h-4 w-4" /> Mais
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setMergeOpen(true)}>
                <Merge className="mr-2 h-3.5 w-3.5" /> Mesclar duplicados
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className={cn('grid flex-1 min-h-0 gap-0 md:p-2', !selected
          ? 'md:grid-cols-[minmax(240px,26%)_minmax(0,1fr)]'
          : leadPanelOpen
            ? 'md:grid-cols-[minmax(170px,23%)_minmax(230px,1fr)_minmax(250px,30%)] xl:grid-cols-[minmax(230px,20%)_minmax(0,53%)_minmax(290px,27%)]'
            : 'md:grid-cols-[minmax(240px,26%)_minmax(0,1fr)]')}>
        {/* Lista */}
        <div className={cn('min-h-0 overflow-y-auto md:border md:rounded-l-lg md:bg-card', (selected || mobileStartVisible) && 'hidden md:block')}>
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : prioritized.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {search ? 'Nenhum resultado' : 'Nenhuma conversa registrada ainda.'}
            </div>
          ) : (
            <div className="divide-y">
              {prioritized.map(({ item, priority }) => {
                const priorityTone = getCrmInboxPriorityTone(priority);
                const isSelected = selectedId === item.id;
                return (
                <button
                  key={item.id}
                  onClick={() => void openConversation(item)}
                  aria-current={isSelected ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-start gap-2.5 border-l-[3px] px-2.5 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500 dark:hover:bg-slate-800/60',
                    getCrmInboxPriorityRailClass(priorityTone),
                    isSelected && 'bg-sky-50 ring-1 ring-inset ring-sky-300 dark:bg-sky-950/40 dark:ring-sky-700',
                  )}
                >
                  <ContactAvatar name={item.name} photoUrl={item.photo_url} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-5 text-foreground" title={item.name}>{item.name}</span>
                      <span className="shrink-0 pt-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                        {formatLastDate(item.last_date)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[11px] leading-4 text-slate-600 dark:text-slate-300" title={item.last_summary || 'Sem interações'}>
                      {item.last_summary || 'Sem interações'}
                    </p>
                    {/* Primeiro: identidade comercial/canal; depois: demanda operacional e janela Meta. */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <Badge variant="outline" className={cn('h-5 px-1.5 text-[10px] font-semibold', getCrmInboxBadgeToneClass(getCrmInboxStageTone(item.funnel_status)))}>
                        {getCrmStageLabel(item.funnel_status)}
                      </Badge>
                      {(item.platform_name || item.channel) && (
                        <Badge variant="outline" className="h-5 max-w-full truncate border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
                          {item.platform_name || item.channel}
                        </Badge>
                      )}
                      {isPureSupplier(item) && (
                        <Badge variant="outline" className="h-5 border-slate-300 bg-slate-100 px-1.5 text-[10px] text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                          Fornecedor
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {item.attendance_state &&
                        !(
                          (item.attendance_state === 'responder' && priority.reason === 'needs_reply') ||
                          (priority.reason === 'waiting_customer' &&
                            ['aguardando_cliente', 'aguardando_resposta', 'awaiting_response', 'waiting_customer'].includes(item.attendance_state))
                        ) && (
                        <Badge variant="outline" className={cn('h-5 px-1.5 text-[10px] font-semibold', getCrmInboxBadgeToneClass(getCrmInboxAttendanceTone(item.attendance_state)))}>
                          {ATTENDANCE_STATE_LABELS[item.attendance_state] || item.attendance_state}
                        </Badge>
                      )}
                      {priority.reason && (
                        <Badge variant="outline" title={`Prioridade ${priority.level}: ${priority.label}`} className={cn('h-5 gap-1 px-1.5 text-[10px] font-bold', getCrmInboxBadgeToneClass(priorityTone))}>
                          <span className="opacity-75">{priority.level}</span> {priority.label}
                        </Badge>
                      )}
                      {item.unread_count > 0 && (
                        <Badge variant="outline" aria-label={`${item.unread_count} mensagens não lidas`} className="h-5 min-w-5 justify-center border-sky-800 bg-sky-700 px-1.5 text-[10px] font-bold text-white dark:border-sky-400 dark:bg-sky-600 dark:text-white">
                          {item.unread_count}
                        </Badge>
                      )}
                      {(item.channel?.toLowerCase() === 'whatsapp' || item.platform_name?.toLowerCase().includes('whatsapp')) && (
                        <MetaWindowBadge lastInboundAt={item.last_inbound_at} compact className="h-5 px-2 text-[10px] font-semibold" />
                      )}
                    </div>
                  </div>
                </button>
              );})}
              {items.length >= loadLimit && (
                <div className="p-3 text-center">
                  <Button variant="outline" size="sm" onClick={() => setLoadLimit(limit => limit + 200)}>Carregar mais conversas</Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Painel detalhe */}
        <div className={cn('min-h-0 min-w-0 overflow-hidden md:border-y md:border-r md:bg-card flex flex-col',
          !selected && !mobileStartVisible && 'hidden md:flex',
          mobileProfileOpen && 'hidden md:flex')}>
          {/* A Start permanece montada para preservar o resultado do lote inicial durante atendimentos. */}
          <div className={cn('min-h-0 flex-1 overflow-y-auto', selected && 'hidden')}>
            <StartOpportunityPanel active={!selected && !loading && (!isMobile || mobileStartVisible)} />
          </div>
          {selected && (
            <div className="flex min-h-0 flex-1 flex-col">
              {/* D-02 — identidade, responsabilidade, comandos essenciais e suporte contextual.
                  Os handlers da D-01 permanecem inalterados; apenas a apresentação muda. */}
              <header className="shrink-0 border-b bg-card px-2 py-1.5 md:px-3 md:py-2" aria-label="Cabeçalho do atendimento">
                <div className="flex min-w-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 md:hidden"
                    onClick={() => {
                      if (guardedSelectContact(null)) setMobileStartVisible(true);
                    }}
                    aria-label="Voltar à Start de oportunidades"
                    title="Voltar à Start"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <ContactAvatar name={selected.name} photoUrl={selected.photo_url} size="md" editable onPhotoChange={updateSelectedPhoto} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium" title={selected.name}>{selected.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground" title={[selected.whatsapp || selected.phone || 'Sem telefone', getCrmStageLabel(selected.funnel_status), selected.platform_name || selected.channel || 'Canal não informado'].join(' · ')}>
                      {selected.whatsapp || selected.phone || 'Sem telefone'} · {getCrmStageLabel(selected.funnel_status)} · {selected.platform_name || selected.channel || 'Canal não informado'}
                    </div>
                    {campaignContext && (
                      <div className="truncate text-[10px] text-muted-foreground/80">
                        Origem: Campanha — {campaignContext.campaignName}
                        {campaignContext.responded ? ' · respondeu' : ''}
                      </div>
                    )}
                  </div>
                  <MetaWindowBadge lastInboundAt={selected.last_inbound_at} className="hidden h-7 shrink-0 px-1.5 text-[10px] sm:inline-flex sm:px-2" />
                </div>

                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[11px] text-muted-foreground">
                    {selected.status === 'resolved' ? 'Atendimento resolvido' : selected.assigned_to ? 'Responsável atribuído' : 'Sem responsável'}
                  </span>
                  <MetaWindowBadge lastInboundAt={selected.last_inbound_at} compact className="h-5 shrink-0 px-1.5 text-[9px] sm:hidden" />
                  {selectedIsOutOfQueue && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">Fora da fila</Badge>
                  )}
                  {!selected.assigned_to && (
                    <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs"
                      disabled={!isLinked || attendanceBusy || saleDecisionBusy}
                      onClick={() => void updateAttendance({ assigned_to: activeUserId, attendance_state: 'em_atendimento', status: 'open', resolved_at: null }, 'Atendimento assumido.')}
                    >
                      <UserCheck className="h-3.5 w-3.5" /> Assumir
                    </Button>
                  )}
                  {selected.assigned_to && selected.status !== 'resolved' && (
                    <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs"
                      disabled={attendanceBusy || saleDecisionBusy}
                      onClick={() => void updateAttendance({ assigned_to: null, attendance_state: null }, 'Atendimento liberado para a equipe.')}
                    >
                      <UserMinus className="h-3.5 w-3.5" /> Liberar
                    </Button>
                  )}
                  {attendanceBusy && (
                    <span role="status" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Salvando atendimento...
                    </span>
                  )}
                </div>

                <div className="mt-1.5 flex min-w-0 flex-col gap-1.5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-2 lg:gap-y-1.5">
                  <div className="grid min-w-0 grid-cols-2 gap-1 sm:flex sm:flex-wrap sm:items-center" role="group" aria-label="Comandos essenciais do atendimento">
                    {selected.status === 'resolved' ? (
                      <Button type="button" size="sm" variant="outline" className="h-8 min-w-0 justify-center gap-1 whitespace-nowrap px-2 text-xs"
                        disabled={attendanceBusy || saleDecisionBusy}
                        onClick={() => void updateAttendance({ status: 'open', resolved_at: null, attendance_state: 'em_atendimento', assigned_to: activeUserId }, 'Atendimento reaberto.')}
                        title="Reabrir o atendimento resolvido"
                      >
                        <RotateCcw className="h-3.5 w-3.5 shrink-0" /> Reabrir
                      </Button>
                    ) : (
                      <Button type="button" size="sm" variant="outline" className="h-8 min-w-0 justify-center gap-1 whitespace-nowrap px-2 text-xs"
                        disabled={attendanceBusy || saleDecisionBusy}
                        onClick={requestConcludeSelectedConversation}
                        title="Concluir atendimento; não registra Resultado comercial nem encerra tarefas oficiais"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> Concluir
                      </Button>
                    )}
                    <Button type="button" size="sm" variant="outline" className="h-8 min-w-0 justify-center gap-1 whitespace-nowrap px-2 text-xs"
                      disabled={attendanceBusy || saleDecisionBusy}
                      onClick={() => { if (guardProfileExit()) setSaleOpen(true); }}
                      title="Registrar venda deste contato no fluxo oficial"
                    >
                      <ShoppingCart className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> Registrar venda
                    </Button>
                    <Button type="button" size="sm"
                      variant={selectedIsOutOfQueue ? 'secondary' : 'outline'}
                      className="col-span-2 h-8 min-w-0 justify-center gap-1 whitespace-nowrap px-2 text-xs sm:col-auto"
                      disabled={attendanceBusy || saleDecisionBusy}
                      onClick={() => void toggleSelectedOutOfQueue()}
                      title={selectedIsOutOfQueue ? 'Voltar para a fila operacional, sem reabrir conversa' : 'Tirar da fila operacional, sem arquivar ou concluir'}
                      aria-label={selectedIsOutOfQueue ? 'Voltar para fila' : 'Tirar da fila'}
                    >
                      {selectedIsOutOfQueue
                        ? <Eye className="h-3.5 w-3.5 shrink-0" />
                        : <EyeOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      {selectedIsOutOfQueue ? 'Voltar à fila' : 'Tirar da fila'}
                    </Button>
                  </div>

                  <div className="flex min-w-0 flex-wrap items-center gap-1" role="group" aria-label="Acesso e ferramentas de suporte">
                    <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs"
                      disabled={!selected.whatsapp && !selected.phone}
                      onClick={() => openWhatsApp(selected.whatsapp || selected.phone || '')}
                      title="Abrir WhatsApp; abrir não registra envio ou Resultado"
                    >
                      <Phone className="h-3.5 w-3.5 text-green-600" /> WhatsApp
                    </Button>
                    <Button type="button" size="sm"
                      variant={(isMobile ? mobileProfileOpen : leadPanelOpen) ? 'secondary' : 'ghost'}
                      className="h-8 gap-1 px-2 text-xs"
                      disabled={Boolean(activeActionMode)}
                      onClick={() => {
                        if (!guardProfileExit()) return;
                        if (isMobile) {
                          setLeadPanelOpen(true);
                          setMobileProfileOpen((v) => !v);
                        } else setLeadPanelOpen((v) => !v);
                      }}
                      aria-expanded={isMobile ? mobileProfileOpen : leadPanelOpen}
                      title={activeActionMode ? 'Conclua ou cancele a ação antes de ocultar o painel' : isMobile ? (mobileProfileOpen ? 'Voltar à conversa' : 'Mostrar ficha do contato') : leadPanelOpen ? 'Ocultar ficha do contato' : 'Mostrar ficha do contato'}
                    >
                      <PanelRight className="h-3.5 w-3.5" /> Ficha
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs" aria-label="Ferramentas do atendimento">
                          <MoreHorizontal className="h-3.5 w-3.5" /> Ferramentas
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem disabled={summaryLoading || attendanceBusy || saleDecisionBusy}
                          onSelect={() => void handleSummarize(selected.id)}>
                          <Sparkles className="mr-2 h-4 w-4 text-primary" />
                          Gerar resumo com IA
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={attendanceBusy || saleDecisionBusy}
                          onSelect={() => void archiveSelectedConversation()}>
                          <Archive className="mr-2 h-4 w-4 text-muted-foreground" />
                          Arquivar conversa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </header>

              {/* F2-A — orientação compacta, exclusivamente de leitura. */}
              {selectedOrientation && selectedOrientation.contactId === selected.id && (
                <div
                  key={`${selectedOrientation.contactId}|${selectedOrientation.conversationId ?? ''}`}
                  aria-label="Orientação operacional do contato"
                  aria-live="polite"
                  className="mx-3 mt-1.5 shrink-0 rounded-md border bg-muted/30 px-2 py-1.5 text-xs"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 flex-1 truncate font-medium" title={selectedOrientation.title}>Orientação · {selectedOrientation.title}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {selectedOrientation.mode === 'action' ? 'Ação' : selectedOrientation.mode === 'verify' ? 'Conferir' : 'Aguardar'} · {selectedOrientation.priorityLevel} · {selectedOrientation.priorityLabel}
                      {selectedIsOutOfQueue ? ' · Fora da fila' : ''}
                    </span>
                    {orientationShortcut && (
                      <Button type="button" size="sm" variant="outline" className="h-7 shrink-0 px-2 text-[11px]"
                        onClick={prepareOrientationShortcut}>
                        {orientationShortcut.label}
                      </Button>
                    )}
                    <Button type="button" size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-[11px]"
                      onClick={() => setOrientationExpanded(value => !value)} aria-expanded={orientationExpanded}
                      aria-label={orientationExpanded ? 'Ocultar detalhes da orientação' : 'Ver detalhes da orientação'}>
                      {orientationExpanded ? 'Recolher' : 'Detalhes'} <ChevronDown className={cn('ml-1 h-3 w-3 transition-transform', orientationExpanded && 'rotate-180')} />
                    </Button>
                  </div>
                  {selectedOrientation.handoffUnverified && !orientationExpanded && (
                    <p className="mt-1 text-amber-700 dark:text-amber-300">Atenção: continuidade operacional ainda não verificada. Consulte os detalhes.</p>
                  )}
                  {orientationExpanded && (
                    <>
                  <div className="mt-0.5 flex flex-wrap items-center justify-between gap-1.5">
                    <p className="min-w-0 flex-1 text-muted-foreground">{selectedOrientation.explanation}</p>
                  </div>
                  {(selectedOrientation.obligation || selectedOrientation.handoffUnverified || selectedOrientation.lastResultResponsibility) && (
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                      {selectedOrientation.obligation && (
                        <span>
                          {selectedOrientation.obligation.source === 'official_task' ? 'Tarefa CRM' : 'Próxima Ação registrada'}:
                          {' '}{selectedOrientation.obligation.title || 'sem título'}
                          {selectedOrientation.obligation.dueAt
                            ? ` · ${format(parseISO(selectedOrientation.obligation.dueAt), 'dd/MM HH:mm')}`
                            : ' · sem prazo'}
                        </span>
                      )}
                      {selectedOrientation.lastResultResponsibility && (
                        <span>
                          Último Resultado: iniciativa {selectedOrientation.lastResultResponsibility === 'operator'
                            ? 'do operador'
                            : 'do cliente'}
                        </span>
                      )}
                    </div>
                  )}
                  {handoffEvidence && handoffEvidence.state !== 'not_required' && (
                    <div className="mt-1 text-muted-foreground" aria-label="Evidência de continuidade operacional">
                      {handoffEvidence.explicitOrderLinkVerified && (
                        <span className="font-medium">Pedido {handoffEvidence.orderNumber || handoffEvidence.orderId} · </span>
                      )}
                      {handoffEvidence.message}
                      {handoffEvidence.operationalStatus && (
                        <span> · Estado do Pedido em Operações: {handoffEvidence.operationalStatus}.</span>
                      )}
                      {handoffQueueEvidence
                        && handoffQueueEvidence.state !== 'not_applicable'
                        && handoffQueueEvidence.state !== 'cancelled' && (
                        <div className="mt-0.5">
                          <span className={handoffQueueEvidence.queueRegistrationVerified
                            ? 'font-medium text-foreground/80' : ''}>
                            Entrada na Separação ·{' '}
                          </span>
                          {handoffQueueEvidence.message}
                          {handoffQueueEvidence.registeredAt && (
                            <span> · {format(parseISO(handoffQueueEvidence.registeredAt), 'dd/MM/yyyy HH:mm')}</span>
                          )}
                        </div>
                      )}
                      {operationalActionEvidence
                        && operationalActionEvidence.state !== 'not_applicable'
                        && operationalActionEvidence.state !== 'cancelled' && (
                        <div className="mt-0.5">
                          <span className={operationalActionEvidence.assumedInFlowVerified
                            ? 'font-medium text-foreground/80' : ''}>
                            {operationalActionEvidence.assumedInFlowVerified
                              ? 'Assumido no fluxo · ' : 'Atuação operacional · '}
                          </span>
                          {operationalActionEvidence.message}
                          {operationalActionEvidence.assumedInFlowAt && (
                            <span> · Início: {format(parseISO(operationalActionEvidence.assumedInFlowAt), 'dd/MM/yyyy HH:mm')}</span>
                          )}
                          {operationalActionEvidence.activityAt
                            && operationalActionEvidence.activityAt !== operationalActionEvidence.assumedInFlowAt && (
                            <span> · Última ação: {format(parseISO(operationalActionEvidence.activityAt), 'dd/MM/yyyy HH:mm')}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                    </>
                  )}
                </div>
              )}

              {/* Conversa (padrão) + Histórico */}
              <Tabs value={detailTab} onValueChange={value => {
                setDetailTab(value as "conversa" | "historico");
                if (value === 'historico') setReplyFocusRequest(null);
              }} className="flex min-h-0 flex-1 flex-col" key={selected.id}>
                <div className="px-3 pt-2">
                  <TabsList className="h-8">
                    <TabsTrigger value="conversa" className="text-xs h-6 gap-1">
                      <MessageCircle className="h-3 w-3" /> Conversa
                    </TabsTrigger>
                    <TabsTrigger value="historico" className="text-xs h-6 gap-1">
                      <Clock className="h-3 w-3" /> Histórico
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="conversa" className="p-3 pt-2 mt-0 min-h-0 flex-1 overflow-hidden flex flex-col">
                  <ContactChatPanel
                    contactId={selected.id}
                    contactName={selected.name}
                    contactHandle={selected.whatsapp || selected.phone}
                    contactAvatar={selected.photo_url}
                    funnelStage={selected.funnel_status}
                    knownConversationId={selected.conversation_id || null}
                    knownCommercialOptOut={selected.commercial_opt_out}
                    heightClassName="min-h-0 flex-1"
                    assistantPortalTarget={!isMobile && leadPanelOpen ? assistantPortalTarget : null}
                    onAssistantRequested={() => { setLeadPanelOpen(true); setContextTab('assistant'); }}
                    focusRequest={replyFocusRequest}
                    onPreparationHandled={id => setReplyFocusRequest(current => current?.id === id ? null : current)}
                    onMessageSent={() => setSendConfirmation(true)}
                    onOutboundConfirmed={() => load().then(() => undefined)}
                    onDraftStateChange={onChatDraftStateChange}
                    onUseSuggestedResult={setSuggestedResultCode}
                    onScheduleManualFollowUp={() => setAttendanceActionRequest({ mode: 'snooze', id: Date.now() })}
                    onRegisterManualResult={() => setAttendanceActionRequest({ mode: 'outcome', id: Date.now() })}
                  />
                  {sendConfirmation && (
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                      <span>Mensagem enviada · aguardando resposta · retorno automático em 2 dias.</span>
                      <Button size="sm" variant="ghost" className="h-7 shrink-0 text-[11px]" onClick={() => setSendConfirmation(false)}>Manter</Button>
                    </div>
                  )}
                  <div className="mt-2 space-y-2">
                    {operationalHandoff && (
                      <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            <strong>{operationalHandoff.label}</strong> · a continuidade agora é operacional.
                            {operationalHandoff.resultCode === 'CRM-RES-021'
                              ? ' Se a venda ainda não foi registrada, registre-a; se já existe, confira em Operações.'
                              : ' Confira o próximo passo no módulo responsável.'}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {operationalHandoff.resultCode === 'CRM-RES-021' && (
                              <Button size="sm" className="h-7 gap-1 px-2 text-[10px]" onClick={() => setSaleOpen(true)}>
                                <ShoppingCart className="h-3.5 w-3.5" /> Registrar venda
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[10px]" asChild>
                              <Link to="/operacoes">Abrir Operações <ArrowRight className="h-3.5 w-3.5" /></Link>
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => setOperationalHandoff(null)}>
                              Depois
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    {getCrmPriority(toCrmPriorityInput(selected)).reason === 'pending_result'
                      && Boolean(selected.last_result_at)
                      && isWaitingCustomerState(selected.attendance_state)
                      && !selected.needs_reply
                      && Boolean(selected.last_inbound_at && selected.last_outbound_at
                        && Date.parse(selected.last_outbound_at) >= Date.parse(selected.last_inbound_at))
                      && (!selected.next_action_date || Date.parse(selected.next_action_date) > Date.now()) && (
                        <Button variant="outline" size="sm" className="h-7 text-xs self-start"
                          disabled={attendanceBusy} onClick={() => void acknowledgeNoNewFact()}
                          title="O operador confirma que respondeu à mensagem e não houve fato comercial novo. Não registra Resultado.">
                          Sem fato novo — retirar da prioridade
                        </Button>
                      )}
                    <AttendanceActionBar busy={attendanceBusy} contextKey={`${selected.id}|${selected.conversation_id ?? ''}`} onOutcome={registerOutcome} onSnooze={snoozeSelected} presetResultCode={suggestedResultCode} openModeRequest={attendanceActionRequest} taskContextTitle={selectedOrientation?.obligation?.title ?? selected.next_action_title ?? null} formPortalTarget={!isMobile && leadPanelOpen ? actionPortalTarget : null} onModeChange={handleAttendanceModeChange} />
                    {attendanceQueue.length > 0 && (
                      <div className="flex items-center justify-between rounded-md border px-2 py-1.5 text-[11px]">
                        <span>Fila Hoje · {Math.max(1, attendanceQueue.findIndex(q => q.id === selected.id) + 1)} de {attendanceQueue.length}</span>
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-[11px]" disabled={attendanceBusy || saleDecisionBusy} onClick={() => nextAttendance()}>
                          Próximo atendimento <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="historico" className="p-3 pt-2 mt-0 min-h-0 flex-1 overflow-y-auto">
                  <ContactTimeline contactId={selected.id} />
                </TabsContent>
              </Tabs>

            </div>
          )}
        </div>
        {leadPanelOpen && selected && (
          <aside className={cn('min-h-0 flex-col overflow-hidden rounded-lg border bg-card md:flex md:rounded-l-none md:rounded-r-lg', mobileProfileOpen ? 'flex' : 'hidden')}>
            <div className="flex items-center justify-between border-b px-3 py-2">
              <div className="flex min-w-0 items-center gap-1 rounded-md bg-muted/60 p-0.5" role="group" aria-label="Conteúdo do painel contextual">
                <Button type="button" size="sm" variant={contextTab === 'assistant' ? 'secondary' : 'ghost'} className="h-8 px-3 text-xs" onClick={() => { if (guardProfileExit()) setContextTab('assistant'); }} aria-pressed={contextTab === 'assistant'}>Assistente CRM</Button>
                <Button type="button" size="sm" variant={contextTab === 'lead' ? 'secondary' : 'ghost'} className="h-8 px-3 text-xs" onClick={() => setContextTab('lead')} aria-pressed={contextTab === 'lead'}>Ficha do contato</Button>
                {activeActionMode && <Button type="button" size="sm" variant={contextTab === 'action' ? 'secondary' : 'ghost'} className="h-8 px-2 text-xs" onClick={() => { if (guardProfileExit()) setContextTab('action'); }} aria-pressed={contextTab === 'action'}>Ação</Button>}
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" disabled={Boolean(activeActionMode)} onClick={() => {
                if (!guardProfileExit()) return;
                if (isMobile) setMobileProfileOpen(false);
                else setLeadPanelOpen(false);
              }} aria-label="Fechar painel contextual" title={activeActionMode ? "Conclua ou cancele a ação antes de fechar" : "Ocultar painel"}><X className="h-4 w-4" /></Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {/* Target estável: alternar a visualização não desmonta a análise do Assistente. */}
              <div ref={setActionPortalTarget} className={cn('space-y-2 p-3', contextTab !== 'action' && 'hidden')} role="region" aria-label="Ação de atendimento" />
              <div ref={setAssistantPortalTarget} className={cn('space-y-2 p-3', contextTab !== 'assistant' && 'hidden')} role="region" aria-label="Assistente CRM">
                <p className="text-xs text-muted-foreground">As sugestões aparecem aqui ao solicitar uma análise da conversa.</p>
              </div>
              <div className={cn('space-y-3 p-3', contextTab !== 'lead' && 'hidden')} role="region" aria-label="Ficha do contato">
                <ContactProfileOverview contact={leadContact} conversationId={selected.conversation_id} onSaved={onProfileSaved} onEditingChange={onProfileEditingChange} onPhotoChange={updateSelectedPhoto} />
                <InboxNoteBlock contactId={selected.id} conversationId={selected.conversation_id} onSaved={load} onRegisterSale={() => setSaleOpen(true)} />

              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Quick conversation */}

      {selected && (
        <InboxSaleDialog
          open={saleOpen}
          onOpenChange={setSaleOpen}
          contactId={selected.id}
          conversationId={selected.conversation_id ?? null}
          contactName={selected.name}
          contactHandle={selected.whatsapp || selected.phone}
          onCreated={load}
          onSaleCreated={() => {
            setOperationalHandoff(null);
            setSaleDecisionOpen(true);
          }}
        />
      )}
      <AlertDialog open={saleDecisionOpen} onOpenChange={setSaleDecisionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Venda registrada com sucesso</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja concluir este atendimento comercial e agendar o pós-venda, ou manter a conversa aberta?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={saleDecisionBusy}>Manter conversa aberta</AlertDialogCancel>
            <AlertDialogAction disabled={saleDecisionBusy} onClick={(event) => {
              event.preventDefault();
              void concludeSaleAttendance();
            }}>
              {saleDecisionBusy ? 'Agendando pós-venda...' : 'Concluir atendimento e agendar pós-venda'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* D-03: confirmação contextual não altera a regra canônica de Concluir. */}
      <AlertDialog open={Boolean(concludeIntent)} onOpenChange={(open) => { if (!open) setConcludeIntent(null); }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir atendimento com pendências?</AlertDialogTitle>
            <AlertDialogDescription>{concludeIntent?.warning}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel>Voltar ao atendimento</AlertDialogCancel>
            <AlertDialogAction disabled={attendanceBusy || saleDecisionBusy}
              onClick={() => {
                const intent = concludeIntent;
                setConcludeIntent(null);
                if (!intent || selectedContextRef.current !== `${intent.contactId}|${intent.conversationId ?? ''}`) {
                  toast.warning('O contato mudou. Revise o atendimento antes de concluir.');
                  return;
                }
                concludeSelectedConversation();
              }}>
              Concluir somente a conversa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MergeDuplicatesDialog open={mergeOpen} onOpenChange={setMergeOpen} onMerged={load} />


      {/* Summary modal */}
      {summaryOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !summaryLoading && setSummaryOpen(false)}
        >
          <Card
            className="max-w-lg w-full max-h-[80vh] overflow-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Resumo IA do contato</h2>
            </div>
            {summaryLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Analisando histórico e gerando briefing...
              </div>
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{summary}</ReactMarkdown>
              </div>
            )}
            <div className="flex justify-end mt-4">
              <Button size="sm" variant="outline" onClick={() => setSummaryOpen(false)} disabled={summaryLoading}>
                Fechar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}