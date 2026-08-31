import { useState, useMemo, useCallback, useEffect, lazy, Suspense, useDeferredValue, useRef, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  MessageCircle,
  ShoppingCart,
  LayoutGrid,
  List,
  Triangle,
  ArrowRight,
  Filter,
  UserPlus,
  Users,
  FileText,
  Handshake,
  DollarSign,
  Flame,
  Snowflake,
  Sun,
  Clock,
  TrendingUp,
  History,
  Tag,
  ArrowUpDown,
  CalendarClock,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Thermometer,
  Phone,
  Lightbulb,
  Send,
  Megaphone,
  Heart,
} from 'lucide-react';
import { useContacts, Contact } from '@/hooks/useContacts';
import { useContactHistory } from '@/hooks/useContactHistory';
import { useNoResponseDetection } from '@/hooks/useNoResponseDetection';
import { useContactChecklist } from '@/hooks/useContactChecklist';
import { useDailyMetrics } from '@/hooks/useDailyMetrics';
import { useLeadScore } from '@/hooks/useLeadScore';
import { useContactTags } from '@/hooks/useContactTags';
import { useContactNextTasks } from '@/hooks/useContactNextTasks';
import { useAllConversationsSummary } from '@/hooks/useAllConversationsSummary';
import { LeadsNeedContactPanel } from '@/components/crm/LeadsNeedContactPanel';
import { CrmAutomationHub } from '@/components/crm/CrmAutomationHub';
import { CrmIndicatorsPanel } from '@/components/crm/CrmIndicatorsPanel';
import { computeAttention, getUrgencyReason, matchesAttention, ATTENTION_LABELS, type AttentionKey } from '@/lib/crm/attentionFilters';
import { CrmFocusQueue, type QueueOutcome } from '@/components/crm/CrmFocusQueue';
import { cn } from '@/lib/utils';
import { ContactAvatar } from '@/components/crm/ContactAvatar';
import { ContactCard } from '@/components/crm/ContactCard';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Zap } from 'lucide-react';
import { differenceInDays, parseISO, format, isSameDay, isBefore, startOfDay } from 'date-fns';
import { toast } from 'sonner';
import { useVirtualizer } from '@tanstack/react-virtual';
import { openWhatsApp } from '@/lib/whatsapp';
import { useWhatsAppWithLog, type WhatsAppOperationalResult } from '@/hooks/useWhatsAppWithLog';
import { getTodayISO } from '@/lib/dateUtils';
import { CRM_EVENT_CODES, normalizeCrmStage } from '@/lib/crm/model';
import { clearCrmNextAction, setCrmNextAction } from '@/lib/crm/nextAction';
import { CrmTodayView } from '@/components/crm/CrmTodayView';
import { applyAttendanceOutcome, snoozeAttendance, type AttendanceOutcome } from '@/lib/crm/attendance';

// Lazy-loaded heavy components (dialogs/drawers/views só carregam quando abertos)
const ContactFormDialog = lazy(() => import('@/components/financial/ContactFormDialog').then(m => ({ default: m.ContactFormDialog })));
const WhatsAppMessageSelector = lazy(() => import('@/components/crm/WhatsAppMessageSelector').then(m => ({ default: m.WhatsAppMessageSelector })));
const LostReasonDialog = lazy(() => import('@/components/crm/LostReasonDialog').then(m => ({ default: m.LostReasonDialog })));
const ContactOrderHistory = lazy(() => import('@/components/financial/ContactOrderHistory').then(m => ({ default: m.ContactOrderHistory })));
const ContactHistoryDialog = lazy(() => import('@/components/ContactHistoryDialog').then(m => ({ default: m.ContactHistoryDialog })));
const ContactTagsManager = lazy(() => import('@/components/crm/ContactTagsManager').then(m => ({ default: m.ContactTagsManager })));
const LeadImportDialog = lazy(() => import('@/components/crm/LeadImportDialog').then(m => ({ default: m.LeadImportDialog })));
import { supabase } from '@/integrations/supabase/client';
import type { CrmCampaign } from '@/hooks/useCrmCampaigns';
const ContactActivitiesPanel = lazy(() => import('@/components/crm/ContactActivitiesPanel').then(m => ({ default: m.ContactActivitiesPanel })));
const BulkWhatsAppDispatch = lazy(() => import('@/components/crm/BulkWhatsAppDispatch').then(m => ({ default: m.BulkWhatsAppDispatch })));
const CampaignCreateDialog = lazy(() => import('@/components/crm/CampaignCreateDialog').then(m => ({ default: m.CampaignCreateDialog })));

const CampaignReviewDialog = lazy(() => import('@/components/crm/CampaignReviewDialog').then(m => ({ default: m.CampaignReviewDialog })));
const KommoFunnelView = lazy(() => import('@/components/crm/KommoFunnelView').then(m => ({ default: m.KommoFunnelView })));
const LeadDetailDrawer = lazy(() => import('@/components/crm/LeadDetailDrawer').then(m => ({ default: m.LeadDetailDrawer })));
const FunnelAutomationsPanel = lazy(() => import('@/components/crm/FunnelAutomationsPanel').then(m => ({ default: m.FunnelAutomationsPanel })));
const PosVendaPanel = lazy(() => import('@/components/crm/PosVendaPanel').then(m => ({ default: m.PosVendaPanel })));


const FUNNEL_STAGES = [
  { key: 'novo_lead', label: 'Novo Lead', color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50/80 border-blue-200', headerBg: 'bg-gradient-to-r from-blue-500 to-blue-400' },
  { key: 'contato_realizado', label: 'Contato Realizado', color: 'bg-cyan-500', textColor: 'text-cyan-700', bgLight: 'bg-cyan-50/80 border-cyan-200', headerBg: 'bg-gradient-to-r from-cyan-500 to-cyan-400' },
  { key: 'proposta_enviada', label: 'Proposta Enviada', color: 'bg-amber-500', textColor: 'text-amber-700', bgLight: 'bg-amber-50/80 border-amber-200', headerBg: 'bg-gradient-to-r from-amber-500 to-amber-400' },
  { key: 'negociacao', label: 'Negociação', color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50/80 border-orange-200', headerBg: 'bg-gradient-to-r from-orange-500 to-orange-400' },
  { key: 'fechado', label: 'Fechado', color: 'bg-green-500', textColor: 'text-green-700', bgLight: 'bg-green-50/80 border-green-200', headerBg: 'bg-gradient-to-r from-green-500 to-green-400' },
  { key: 'pos_venda', label: 'Pós-Venda', color: 'bg-pink-500', textColor: 'text-pink-700', bgLight: 'bg-pink-50/80 border-pink-200', headerBg: 'bg-gradient-to-r from-pink-500 to-pink-400' },
  { key: 'cadencia', label: 'Cadência', color: 'bg-violet-500', textColor: 'text-violet-700', bgLight: 'bg-violet-50/80 border-violet-200', headerBg: 'bg-gradient-to-r from-violet-500 to-violet-400' },
  { key: 'perdido', label: 'Perdido', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50/80 border-red-200', headerBg: 'bg-gradient-to-r from-red-500 to-red-400' },
];

type PurchaseFilter = 'all' | 'with_purchase' | 'never' | 'last_15' | 'last_30' | 'last_60' | 'last_90' | 'over_90';
type PaidOrdersFilter = 'all' | 'one_plus' | 'two_plus' | 'three_plus';
type ReactivationFilter = 'all' | 'scheduled' | 'overdue' | 'none';
type CommercialOptOutFilter = 'all' | 'eligible' | 'opted_out';

function daysSince(value?: string | null) {
  if (!value) return null;
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return null;
  return differenceInDays(startOfDay(new Date()), startOfDay(date));
}

const getStageNextAction = (stage: string): Partial<Contact> => {
  const actionByStage: Record<string, { text: string; days: number }> = {
    novo_lead: { text: 'Fazer primeiro contato', days: 0 },
    contato_realizado: { text: 'Verificar resposta do cliente', days: 1 },
    proposta_enviada: { text: 'Fazer follow-up da proposta', days: 2 },
    negociacao: { text: 'Conduzir negociação para fechamento', days: 1 },
    fechado: { text: 'Confirmar entrega e satisfação', days: 3 },
    pos_venda: { text: 'Realizar contato de pós-venda', days: 7 },
    cadencia: { text: 'Realizar próximo contato da cadência', days: 3 },
  };

  const action = actionByStage[stage];
  if (!action) {
    return { next_action_text: null, next_action_date: null } as Partial<Contact>;
  }

  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + action.days);
  dueAt.setHours(9, 0, 0, 0);

  return {
    next_action_text: action.text,
    next_action_date: dueAt.toISOString(),
  };
};

const SALES_FUNNEL_STAGES = [
  { key: 'orcamento', label: 'Orçamento', emoji: '🟡', color: 'bg-yellow-500', textColor: 'text-yellow-700', bgLight: 'bg-yellow-50/80 border-yellow-200', headerBg: 'bg-gradient-to-r from-yellow-500 to-yellow-400' },
  { key: 'em_atendimento', label: 'Em atendimento', emoji: '🔵', color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50/80 border-blue-200', headerBg: 'bg-gradient-to-r from-blue-500 to-blue-400' },
  { key: 'cliente_ativo', label: 'Cliente ativo', emoji: '🟢', color: 'bg-green-500', textColor: 'text-green-700', bgLight: 'bg-green-50/80 border-green-200', headerBg: 'bg-gradient-to-r from-green-500 to-green-400' },
  { key: 'inativo', label: 'Inativo', emoji: '🔴', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50/80 border-red-200', headerBg: 'bg-gradient-to-r from-red-500 to-red-400' },
];

const PRIORITY_CONFIG = {
  quente: { label: 'Alta', borderColor: 'border-l-red-400' },
  morno: { label: 'Média', borderColor: 'border-l-amber-400' },
  frio: { label: 'Baixa', borderColor: 'border-l-sky-400' },
};

const URGENCY_LEVELS = {
  urgente: { label: 'Urgente', emoji: '🔴', className: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700', borderColor: 'border-l-red-500', ringClass: 'ring-1 ring-red-300 dark:ring-red-700' },
  medio: { label: 'Médio', emoji: '🟡', className: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700', borderColor: 'border-l-amber-400', ringClass: '' },
  baixo: { label: 'Baixo', emoji: '🔵', className: 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-700', borderColor: 'border-l-sky-300', ringClass: '' },
};

const TEMP_CONFIG = {
  frio: { label: 'Frio', icon: Snowflake, className: 'bg-sky-100 text-sky-700 border-sky-300', dot: 'bg-sky-500' },
  morno: { label: 'Morno', icon: Sun, className: 'bg-amber-100 text-amber-700 border-amber-300', dot: 'bg-amber-500' },
  quente: { label: 'Quente', icon: Flame, className: 'bg-red-100 text-red-700 border-red-300', dot: 'bg-red-500' },
};

const CONTACT_SUBTYPE_CONFIG: Record<string, { label: string; className: string }> = {
  revendedor: { label: 'Revendedor', className: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  cliente_final: { label: 'Cliente Final', className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  atacado: { label: 'Atacado', className: 'bg-violet-100 text-violet-700 border-violet-300' },
};

const CLIENT_CLASSIFICATION_CONFIG: Record<string, { label: string; emoji: string; className: string }> = {
  vip: { label: 'VIP', emoji: '🟢', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  alto_potencial: { label: 'Alto Potencial', emoji: '🔵', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  medio: { label: 'Médio', emoji: '🟡', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  baixo_potencial: { label: 'Baixo Potencial', emoji: '⚪', className: 'bg-gray-100 text-gray-600 border-gray-300' },
};

function getUltimoContatoAlert(dateStr?: string | null) {
  if (!dateStr) return null;
  try {
    const days = differenceInDays(new Date(), parseISO(dateStr));
    if (days > 7) return { label: `${days}d`, className: 'text-red-600 bg-red-50 border-red-200', urgent: true };
    if (days > 3) return { label: `${days}d`, className: 'text-amber-600 bg-amber-50 border-amber-200', urgent: false };
    return { label: `${days}d`, className: 'text-muted-foreground bg-muted', urgent: false };
  } catch { return null; }
}

function getNextContactStatus(dateStr?: string | null) {
  if (!dateStr) return null;
  try {
    const d = parseISO(dateStr);
    const now = new Date();
    const today = startOfDay(now);
    const targetDay = startOfDay(d);
    if (isSameDay(d, now)) return { label: 'Hoje', className: 'text-amber-700 bg-amber-100 border-amber-300', isToday: true, isOverdue: false };
    if (isBefore(targetDay, today)) {
      const days = differenceInDays(today, targetDay);
      return { label: `${days}d atraso`, className: 'text-red-700 bg-red-100 border-red-300', isToday: false, isOverdue: true };
    }
    return { label: format(d, 'dd/MM'), className: 'text-blue-700 bg-blue-100 border-blue-300', isToday: false, isOverdue: false };
  } catch { return null; }
}

function formatCurrencyShort(v?: number | null) {
  if (!v) return null;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

type SortField = 'name' | 'valor_estimado' | 'ultimo_contato' | 'created_at' | 'temperatura' | 'score';
type SortDir = 'asc' | 'desc';
const LIST_PAGE_SIZE = 50;

function VirtualContactColumn({
  contacts,
  renderContact,
  emptyLabel,
  dragOverLabel,
  isDragOver,
  className,
}: {
  contacts: Contact[];
  renderContact: (contact: Contact) => ReactNode;
  emptyLabel: string;
  dragOverLabel: string;
  isDragOver: boolean;
  className?: string;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: contacts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 145,
    overscan: 6,
    getItemKey: (index) => contacts[index]?.id ?? index,
  });

  if (contacts.length === 0) {
    return (
      <div ref={parentRef} className={cn('flex-1 px-2 py-2 min-h-[300px] max-h-[calc(100vh-340px)] overflow-y-auto', className)}>
        <p className="text-[11px] text-muted-foreground text-center py-6 opacity-60">
          {isDragOver ? dragOverLabel : emptyLabel}
        </p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className={cn('flex-1 px-2 py-2 min-h-[300px] max-h-[calc(100vh-340px)] overflow-y-auto', className)}>
      <div className="relative w-full" style={{ height: rowVirtualizer.getTotalSize() }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const contact = contacts[virtualRow.index];
          return (
            <div
              key={contact.id}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              className="absolute left-0 top-0 w-full pb-1.5"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              {renderContact(contact)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Contatos() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { contacts, loading, createContact, updateContact, markContactTouchedLocal, deleteContact, fetchContacts, fetchContactFull } = useContacts();
  const { addEntry } = useContactHistory();
  const { tags, getTagsForContact } = useContactTags();
  const contactsWithOrders = useMemo(
    () => new Set(contacts.filter(contact => (contact.paid_orders_count || 0) > 0).map(contact => contact.id)),
    [contacts],
  );
  const hasOrders = useCallback((contactId: string) => contactsWithOrders.has(contactId), [contactsWithOrders]);
  const { nextTaskByContact, reactivationByContact } = useContactNextTasks();
  const { byContact: convoSummaryByContact } = useAllConversationsSummary();
  const { getNoResponseInfo, refreshNoResponse } = useNoResponseDetection();
  const { getScore } = useLeadScore(contacts, getNoResponseInfo, hasOrders);
  const contactIds = useMemo(() => contacts.filter(c => c.is_active).map(c => c.id), [contacts]);
  const { checklistMap, refetchChecklists } = useContactChecklist(contactIds);
  const { dailyMetrics, refetchDaily } = useDailyMetrics();
  const { logAndOpen } = useWhatsAppWithLog();
  const [recentlyContacted, setRecentlyContacted] = useState<Map<string, Partial<Contact>>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [listPage, setListPage] = useState(1);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const openContactForm = useCallback(async (contact?: Contact | null) => {
    if (!contact) {
      setEditingContact(undefined);
      setFormOpen(true);
      return;
    }
    setEditingContact(contact);
    setFormOpen(true);
    const full = await fetchContactFull(contact.id);
    if (full) setEditingContact(full);
  }, [fetchContactFull]);

  // Deep-link: abrir contato selecionado vindo de outras telas (ex.: Atendimento)
  useEffect(() => {
    const cid = searchParams.get('contact');
    if (!cid || !contacts.length) return;
    const target = contacts.find(c => c.id === cid);
    if (target) {
      void openContactForm(target);
      setSearchQuery(target.name);
      const next = new URLSearchParams(searchParams);
      next.delete('contact');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, contacts, setSearchParams, openContactForm]);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tempFilter, setTempFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [contactDateFilter, setContactDateFilter] = useState<string>('all');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [originFilter, setOriginFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [responsibleFilter, setResponsibleFilter] = useState<string>('all');
  const [purchaseFilter, setPurchaseFilter] = useState<PurchaseFilter>('all');
  const [paidOrdersFilter, setPaidOrdersFilter] = useState<PaidOrdersFilter>('all');
  const [reactivationFilter, setReactivationFilter] = useState<ReactivationFilter>('all');
  const [commercialOptOutFilter, setCommercialOptOutFilter] = useState<CommercialOptOutFilter>('all');
  const [segmentationMode, setSegmentationMode] = useState(false);
  // FRENTE 3.2 — Campanhas CRM (criação a partir do segmento e revisão de elegibilidade)
  const [campaignCreateOpen, setCampaignCreateOpen] = useState(false);
  const [campaignReview, setCampaignReview] = useState<CrmCampaign | null>(null);
  const [attentionFilter, setAttentionFilter] = useState<AttentionKey>('all');
  const [qualityOnly, setQualityOnly] = useState(false);
  // FRENTE 7A — a operação diária é a Caixa de Entrada; o CRM abre em gestão (Kanban).
  const [viewMode, setViewMode] = useState<'today' | 'kanban' | 'funnel' | 'list' | 'sales_funnel'>('kanban');
  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | undefined>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [automationsOpen, setAutomationsOpen] = useState(false);
  const [posVendaOpen, setPosVendaOpen] = useState(false);
  const [detailContact, setDetailContact] = useState<Contact | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyContact, setHistoryContact] = useState<Contact | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineContact, setTimelineContact] = useState<Contact | null>(null);
  const [tagsManagerOpen, setTagsManagerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [activitiesOpen, setActivitiesOpen] = useState(false);
  const [activitiesContact, setActivitiesContact] = useState<Contact | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Drag state
  const [draggedContact, setDraggedContact] = useState<Contact | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  // Helper: is next action overdue?
  const isNextActionOverdue = useCallback((contact: Contact) => {
    if (!contact.next_action_date) return false;
    try { return new Date() > parseISO(contact.next_action_date); } catch { return false; }
  }, []);

  // ── Organismo único: contatos com overlay otimista + inteligência de atenção ──
  const leadsPanelContacts = useMemo(() => {
    const crmContacts = contacts.filter(contact => !!contact.funnel_status);
    if (recentlyContacted.size === 0) return crmContacts;
    const today = getTodayISO();
    return crmContacts.map(contact => (
      recentlyContacted.has(contact.id)
        ? { ...contact, ultimo_contato: today, ...recentlyContacted.get(contact.id) }
        : contact
    ));
  }, [contacts, recentlyContacted]);

  // Urgency scoring shared between sort and display
  const tempScore: Record<string, number> = { quente: 30, morno: 20, frio: 10 };
  const classScore: Record<string, number> = { vip: 4, alto_potencial: 3, medio: 2, baixo_potencial: 1 };
  const noResponseScoreMap: Record<string, number> = { follow_up_urgente: 80, sem_resposta: 60, lead_esfriando: 40 };

  const getUrgencyScore = useCallback((c: Contact): number => {
    let score = 0;
    const now = new Date();
    const today = startOfDay(now);
    score += tempScore[c.temperatura_lead || 'morno'] || 20;
    const actionOverdue = c.next_action_date && isBefore(startOfDay(parseISO(c.next_action_date)), today);
    const contactOverdue = c.next_contact_date && isBefore(startOfDay(parseISO(c.next_contact_date)), today);
    if (actionOverdue || contactOverdue) score += 100;
    const actionToday = c.next_action_date && isSameDay(parseISO(c.next_action_date), now);
    const contactToday = c.next_contact_date && isSameDay(parseISO(c.next_contact_date), now);
    if (actionToday || contactToday) score += 50;
    const nrInfo = getNoResponseInfo(c.id);
    if (nrInfo) score += noResponseScoreMap[nrInfo.status!] || 0;
    if (c.ultimo_contato) {
      const days = differenceInDays(now, parseISO(c.ultimo_contato));
      if (days > 7) score += 15;
      else if (days > 3) score += 5;
    }
    score += (classScore[c.client_classification || ''] || 0) * 2;
    if (c.valor_estimado && c.valor_estimado > 0) score += Math.min(c.valor_estimado / 1000, 5);
    return score;
  }, [getNoResponseInfo]);

  const getUrgencyLevel = useCallback((contact: Contact): keyof typeof URGENCY_LEVELS => {
    const score = getUrgencyScore(contact);
    if (getUrgencyReason(contact, getNoResponseInfo)) return 'urgente';
    if (score >= 40) return 'medio';
    return 'baixo';
  }, [getUrgencyScore, getNoResponseInfo]);

  const getContactUrgencyReason = useCallback(
    (contact: Contact) => getUrgencyReason(contact, getNoResponseInfo),
    [getNoResponseInfo],
  );

  // Priority sort: overdue > hot+today > hot > warm+overdue > warm > cold > rest
  const prioritySortContacts = useCallback((list: Contact[]) => {
    return [...list].sort((a, b) => {
      const ua = getUrgencyScore(a);
      const ub = getUrgencyScore(b);
      if (ua !== ub) return ub - ua;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [getUrgencyScore]);

  const attentionDeps = useMemo(
    () => ({ getUrgencyLevel, getNoResponseInfo }),
    [getUrgencyLevel, getNoResponseInfo],
  );

  /** Base pós filtros avançados (sem o chip) — alimenta os contadores do Passo 1 */
  const baseFilteredContacts = useMemo(() => {
    const base = segmentationMode ? contacts : leadsPanelContacts;
    return base.filter((c) => {
      if (!c.is_active) return false;
      if (statusFilter !== 'all' && c.funnel_status !== statusFilter) return false;
      if (tempFilter !== 'all' && c.temperatura_lead !== tempFilter) return false;
      if (typeFilter !== 'all') {
        if (typeFilter === 'cliente' && c.type !== 'cliente' && c.type !== 'ambos') return false;
        if (typeFilter === 'fornecedor' && c.type !== 'fornecedor' && c.type !== 'ambos') return false;
      }
      if (tagFilter !== 'all') {
        const contactTags = getTagsForContact(c.id);
        if (!contactTags.some(t => t.id === tagFilter)) return false;
      }
      if (actionFilter === 'hoje') {
        if (!c.next_action_date) return false;
        try { if (!isSameDay(parseISO(c.next_action_date), new Date())) return false; } catch { return false; }
      }
      if (actionFilter === 'atrasados') {
        if (!c.next_action_date || !isNextActionOverdue(c)) return false;
      }
      if (actionFilter === 'sem_acao') {
        if (c.next_action_text || c.next_action_date) return false;
      }
      // Próximo Contato filters
      if (classificationFilter !== 'all' && c.client_classification !== classificationFilter) return false;
      if (originFilter !== 'all') {
        const o = (c.origem_lead || 'Não Informado').trim();
        if (o !== originFilter) return false;
      }
      if (segmentationMode && cityFilter !== 'all' && (c.city || '').trim() !== cityFilter) return false;
      if (segmentationMode && responsibleFilter !== 'all' && (c.salesperson || '').trim() !== responsibleFilter) return false;
      if (segmentationMode) {
        if (commercialOptOutFilter === 'eligible' && c.commercial_opt_out) return false;
        if (commercialOptOutFilter === 'opted_out' && !c.commercial_opt_out) return false;
        const paidOrders = c.paid_orders_count || 0;
        const purchaseAge = daysSince(c.last_purchase_date);
        if (purchaseFilter === 'with_purchase' && paidOrders < 1) return false;
        if (purchaseFilter === 'never' && (paidOrders > 0 || c.last_purchase_date)) return false;
        if (purchaseFilter === 'last_15' && (purchaseAge === null || purchaseAge < 0 || purchaseAge > 15)) return false;
        if (purchaseFilter === 'last_30' && (purchaseAge === null || purchaseAge < 0 || purchaseAge > 30)) return false;
        if (purchaseFilter === 'last_60' && (purchaseAge === null || purchaseAge < 0 || purchaseAge > 60)) return false;
        if (purchaseFilter === 'last_90' && (purchaseAge === null || purchaseAge < 0 || purchaseAge > 90)) return false;
        if (purchaseFilter === 'over_90' && (purchaseAge === null || purchaseAge <= 90)) return false;
        if (paidOrdersFilter === 'one_plus' && paidOrders < 1) return false;
        if (paidOrdersFilter === 'two_plus' && paidOrders < 2) return false;
        if (paidOrdersFilter === 'three_plus' && paidOrders < 3) return false;
        const reactivationDate = reactivationByContact[c.id];
        const reactivationAge = daysSince(reactivationDate);
        if (reactivationFilter === 'scheduled' && !reactivationDate) return false;
        if (reactivationFilter === 'overdue' && (reactivationAge === null || reactivationAge < 0)) return false;
        if (reactivationFilter === 'none' && reactivationDate) return false;
      }
      if (contactDateFilter === 'hoje_contato') {
        if (!c.next_contact_date) return false;
        try {
          const d = parseISO(c.next_contact_date);
          const today = startOfDay(new Date());
          if (!isSameDay(d, new Date()) && !isBefore(startOfDay(d), today)) return false;
        } catch { return false; }
      }
      if (deferredSearchQuery) {
        const q = deferredSearchQuery.toLowerCase();
        const qDigits = deferredSearchQuery.replace(/\D/g, '');
        // Phone fuzzy match: compare only digits, match by suffix (last N digits)
        // tolerates different country/area code prefixes (e.g. 5511987654321 vs 11987654321 vs 987654321)
        const phoneMatch = (val?: string | null) => {
          if (!val || qDigits.length < 4) return false;
          const d = val.replace(/\D/g, '');
          if (!d) return false;
          const min = Math.min(d.length, qDigits.length);
          // require at least 6 trailing digits to match (or full query if shorter)
          const tail = Math.max(6, Math.min(min, qDigits.length));
          return d.slice(-tail) === qDigits.slice(-tail) || d.includes(qDigits);
        };
        return (
          c.name?.toLowerCase().includes(q) ||
          c.fantasy_name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          phoneMatch(c.phone) ||
          phoneMatch(c.whatsapp) ||
          phoneMatch(c.mobile) ||
          c.phone?.toLowerCase().includes(q) ||
          c.whatsapp?.toLowerCase().includes(q) ||
          c.document?.toLowerCase().includes(q) ||
          c.city?.toLowerCase().includes(q) ||
          c.notes?.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [contacts, leadsPanelContacts, segmentationMode, deferredSearchQuery, statusFilter, tempFilter, typeFilter, tagFilter, actionFilter, contactDateFilter, classificationFilter, originFilter, cityFilter, responsibleFilter, purchaseFilter, paidOrdersFilter, reactivationFilter, commercialOptOutFilter, reactivationByContact, getTagsForContact, isNextActionOverdue]);

  const qualityIssueByContact = useMemo(() => {
    const phoneCounts = new Map<string, number>();
    const nameCounts = new Map<string, number>();
    const phoneKey = (contact: Contact) => {
      const digits = (contact.whatsapp || contact.mobile || contact.phone || '').replace(/\D/g, '');
      return digits.length >= 8 ? digits.slice(-10) : '';
    };
    const nameKey = (contact: Contact) => (contact.name || '').trim().toLocaleLowerCase('pt-BR');

    leadsPanelContacts.filter(contact => contact.is_active).forEach(contact => {
      const phone = phoneKey(contact);
      const name = nameKey(contact);
      if (phone) phoneCounts.set(phone, (phoneCounts.get(phone) || 0) + 1);
      if (name.length >= 5) nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
    });

    const issues = new Map<string, string[]>();
    leadsPanelContacts.filter(contact => contact.is_active).forEach(contact => {
      const contactIssues: string[] = [];
      const name = (contact.name || '').trim();
      const phone = phoneKey(contact);
      if (!phone) contactIssues.push('Sem telefone válido');
      if (name.length < 3 || /^\W+$/u.test(name) || /\bnan\b/i.test(name)) contactIssues.push('Nome precisa de revisão');
      if (phone && (phoneCounts.get(phone) || 0) > 1) contactIssues.push('Possível telefone duplicado');
      const normalizedName = nameKey(contact);
      if (normalizedName.length >= 5 && (nameCounts.get(normalizedName) || 0) > 1) contactIssues.push('Possível nome duplicado');
      if (contactIssues.length > 0) issues.set(contact.id, contactIssues);
    });
    return issues;
  }, [leadsPanelContacts]);

  /** Inteligência do Passo 1 — contadores e fila sempre coerentes com os filtros ativos */
  const { counts: attentionCounts, queue: attentionQueue } = useMemo(
    () => computeAttention(baseFilteredContacts, attentionDeps),
    [baseFilteredContacts, attentionDeps],
  );

  /** Resultado único: rege lista, kanban, funil e o painel do Passo 3 */
  const filteredContacts = useMemo(
    () => (qualityOnly
      ? baseFilteredContacts.filter(contact => qualityIssueByContact.has(contact.id))
      : baseFilteredContacts.filter(c => matchesAttention(c, attentionFilter, attentionDeps))),
    [baseFilteredContacts, attentionFilter, attentionDeps, qualityOnly, qualityIssueByContact],
  );

  const filteredQueue = useMemo(
    () => (qualityOnly
      ? []
      : attentionFilter === 'all'
      ? attentionQueue
      : attentionQueue.filter(c => matchesAttention(c, attentionFilter, attentionDeps))),
    [attentionQueue, attentionFilter, attentionDeps, qualityOnly],
  );


  const sortedContacts = useMemo(() => {
    return [...filteredContacts].sort((a, b) => {
      let cmp = 0;
      const tempOrder: Record<string, number> = { quente: 3, morno: 2, frio: 1 };
      if (sortField === 'name') cmp = (a.name || '').localeCompare(b.name || '');
      else if (sortField === 'valor_estimado') cmp = (a.valor_estimado || 0) - (b.valor_estimado || 0);
      else if (sortField === 'ultimo_contato') cmp = (a.ultimo_contato || '').localeCompare(b.ultimo_contato || '');
      else if (sortField === 'created_at') cmp = (a.created_at || '').localeCompare(b.created_at || '');
      else if (sortField === 'temperatura') cmp = (tempOrder[a.temperatura_lead || 'morno'] || 2) - (tempOrder[b.temperatura_lead || 'morno'] || 2);
      else if (sortField === 'score') cmp = getScore(a.id).score - getScore(b.id).score;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredContacts, sortField, sortDir, getScore]);

  const listPageCount = Math.max(1, Math.ceil(sortedContacts.length / LIST_PAGE_SIZE));
  const paginatedContacts = useMemo(() => {
    const start = (listPage - 1) * LIST_PAGE_SIZE;
    return sortedContacts.slice(start, start + LIST_PAGE_SIZE);
  }, [sortedContacts, listPage]);

  useEffect(() => {
    setListPage(1);
  }, [filteredContacts, sortField, sortDir]);

  useEffect(() => {
    if (listPage > listPageCount) setListPage(listPageCount);
  }, [listPage, listPageCount]);


  const groupedByStage = useMemo(() => {
    const groups: Record<string, Contact[]> = {};
    FUNNEL_STAGES.forEach(s => { groups[s.key] = []; });
    filteredContacts.forEach(c => {
      const key = c.funnel_status;
      if (!key) return;
      if (groups[key]) groups[key].push(c);
    });
    Object.keys(groups).forEach(key => {
      groups[key] = prioritySortContacts(groups[key]);
    });
    return groups;
  }, [filteredContacts, prioritySortContacts]);

  const stageSums = useMemo(() => {
    const sums: Record<string, number> = {};
    FUNNEL_STAGES.forEach(s => {
      sums[s.key] = (groupedByStage[s.key] || []).reduce((sum, c) => sum + (c.valor_estimado || 0), 0);
    });
    return sums;
  }, [groupedByStage]);

  const groupedBySalesFunnel = useMemo(() => {
    const groups: Record<string, Contact[]> = {};
    SALES_FUNNEL_STAGES.forEach(s => { groups[s.key] = []; });
    filteredContacts.forEach(c => {
      const key = c.contact_type || 'orcamento';
      if (groups[key]) groups[key].push(c);
      else groups['orcamento'].push(c);
    });
    Object.keys(groups).forEach(key => {
      groups[key] = prioritySortContacts(groups[key]);
    });
    return groups;
  }, [filteredContacts, prioritySortContacts]);

  const salesFunnelSums = useMemo(() => {
    const sums: Record<string, number> = {};
    SALES_FUNNEL_STAGES.forEach(s => {
      sums[s.key] = (groupedBySalesFunnel[s.key] || []).reduce((sum, c) => sum + (c.valor_estimado || 0), 0);
    });
    return sums;
  }, [groupedBySalesFunnel]);

  const metrics = useMemo(() => {
    const active = contacts.filter(c => c.is_active);
    const clientesAtivos = active.filter(c => ['fechado', 'pos_venda'].includes(c.funnel_status));
    const orcamentos = active.filter(c => c.funnel_status === 'proposta_enviada');
    const followUpHoje = active.filter(c => {
      if (!c.next_contact_date) return false;
      try {
        const d = parseISO(c.next_contact_date);
        const today = startOfDay(new Date());
        return isSameDay(d, new Date()) || isBefore(startOfDay(d), today);
      } catch { return false; }
    });
    const propostas = active.filter(c => c.funnel_status === 'proposta_enviada');
    const negociacao = active.filter(c => c.funnel_status === 'negociacao');
    const fechados = active.filter(c => c.funnel_status === 'fechado');
    const openStages = ['novo_lead', 'contato_realizado', 'proposta_enviada', 'negociacao'];
    const valorAberto = active
      .filter(c => openStages.includes(c.funnel_status))
      .reduce((sum, c) => sum + (c.valor_estimado || 0), 0);
    const totalLeads = active.filter(c => c.funnel_status !== 'perdido').length;
    const conversionRate = totalLeads > 0 ? Math.round((fechados.length / totalLeads) * 100) : 0;
    return { total: active.length, propostas: propostas.length, negociacao: negociacao.length, fechados: fechados.length, valorAberto, conversionRate, clientesAtivos: clientesAtivos.length, orcamentos: orcamentos.length, followUpHoje: followUpHoje.length };
  }, [contacts]);

  const handleSave = async (data: Partial<Contact>) => {
    if (editingContact) {
      // Detect follow-up changes
      const oldAction = editingContact.next_action_date || '';
      const newAction = (data.next_action_date as string) || '';
      const oldContact = editingContact.next_contact_date || '';
      const newContact2 = (data.next_contact_date as string) || '';

      const actionChanged = ['next_action_text', 'next_action_date', 'next_contact_date']
        .some((key) => Object.prototype.hasOwnProperty.call(data, key));
      const { next_action_text, next_action_date, next_contact_date, ...contactUpdates } = data;
      await updateContact(editingContact.id, actionChanged ? contactUpdates : data);

      if (actionChanged) {
        const title = next_action_text || editingContact.next_action_text;
        const dueAt = next_action_date || next_contact_date;
        if (title && dueAt) {
          await setCrmNextAction({ contactId: editingContact.id, title, dueAt });
        } else {
          await clearCrmNextAction(editingContact.id);
        }
      }

      // Log next_action_date changes
      if (newAction && newAction !== oldAction) {
        const dateStr = (() => { try { return format(parseISO(newAction), "dd/MM 'às' HH:mm"); } catch { return ''; } })();
        const desc = oldAction
          ? `Follow-up atualizado para ${dateStr}`
          : `Follow-up agendado para ${dateStr}`;
        await addEntry(editingContact.id, 'follow_up', desc, new Date().toISOString(), CRM_EVENT_CODES.FOLLOW_UP_SCHEDULED);
      }

      // Log next_contact_date changes
      if (newContact2 && newContact2 !== oldContact) {
        const dateStr = (() => { try { return format(parseISO(newContact2), "dd/MM 'às' HH:mm"); } catch { return ''; } })();
        const desc = oldContact
          ? `Próximo contato atualizado para ${dateStr}`
          : `Próximo contato agendado para ${dateStr}`;
        await addEntry(editingContact.id, 'follow_up', desc, new Date().toISOString(), CRM_EVENT_CODES.FOLLOW_UP_SCHEDULED);
      }
    } else {
      // This screen is an explicit commercial action: creating here creates a lead.
      const newContact = await createContact({ ...data, funnel_status: data.funnel_status || 'novo_lead' });
      if (newContact?.id) {
        await addEntry(newContact.id, 'lead_criado', 'Lead criado', new Date().toISOString(), CRM_EVENT_CODES.LEAD_CREATED);
      }
    }
    setFormOpen(false);
    setEditingContact(undefined);
  };

  const [lostDialogContact, setLostDialogContact] = useState<Contact | null>(null);

  const applyStatusChange = async (contact: Contact, newStatus: string, extra: Partial<Contact> = {}, historyDesc?: string) => {
    newStatus = normalizeCrmStage(newStatus);
    const oldStage = FUNNEL_STAGES.find(s => s.key === contact.funnel_status);
    const newStage = FUNNEL_STAGES.find(s => s.key === newStatus);
    const suggestedAction = getStageNextAction(newStatus);
    const updates: Partial<Contact> = { funnel_status: newStatus, ...suggestedAction, ...extra };
    if (newStatus === 'fechado' && contact.funnel_status !== 'fechado') {
      updates.converted_at = new Date().toISOString();
      await addEntry(contact.id, 'conversion', 'Negócio fechado!', new Date().toISOString(), CRM_EVENT_CODES.SALE_WON);
      toast.success('🎉 Negócio fechado!');
    } else {
      await addEntry(
        contact.id,
        'stage_change',
        historyDesc || `Movido de "${oldStage?.label || contact.funnel_status}" para "${newStage?.label || newStatus}"`,
        new Date().toISOString(),
        newStatus === 'perdido' ? CRM_EVENT_CODES.SALE_LOST : CRM_EVENT_CODES.STAGE_CHANGED,
        { old_stage: contact.funnel_status, new_stage: newStatus },
      );
    }
    const { next_action_text, next_action_date, next_contact_date, ...contactUpdates } = updates;
    await updateContact(contact.id, contactUpdates);
    if (next_action_text && (next_action_date || next_contact_date)) {
      await setCrmNextAction({ contactId: contact.id, title: next_action_text, dueAt: next_action_date || next_contact_date });
    } else {
      await clearCrmNextAction(contact.id);
    }
    if (suggestedAction.next_action_text) {
      toast.success(`Próxima ação criada: ${suggestedAction.next_action_text}`);
    }
  };

  const handleStatusChange = async (contact: Contact, newStatus: string) => {
    if (newStatus === 'perdido' && contact.funnel_status !== 'perdido') {
      setLostDialogContact(contact);
      return;
    }
    await applyStatusChange(contact, newStatus);
  };

  const handleConfirmLost = async (reason: string, reasonLabel: string, detail: string) => {
    const contact = lostDialogContact;
    if (!contact) return;
    const oldStage = FUNNEL_STAGES.find(s => s.key === contact.funnel_status);
    const desc = `Movido de "${oldStage?.label || contact.funnel_status}" para "Perdido" — Motivo: ${reasonLabel}${detail ? ` (${detail})` : ''}`;
    await applyStatusChange(contact, 'perdido', {
      lost_reason: reason,
      lost_reason_detail: detail || null,
      lost_at: new Date().toISOString(),
    } as any, desc);
    setLostDialogContact(null);
    toast.success('Lead marcado como perdido');
  };

  const [whatsAppContact, setWhatsAppContact] = useState<Contact | null>(null);
  const [bulkDispatchContacts, setBulkDispatchContacts] = useState<Contact[] | null>(null);
  const [focusQueue, setFocusQueue] = useState<Contact[]>([]);
  const [focusQueueOpen, setFocusQueueOpen] = useState(false);
  const [queueSessionSize, setQueueSessionSize] = useState(20);

  const startFocusSession = useCallback((list: Contact[]) => {
    setFocusQueue(list.slice(0, queueSessionSize));
    setFocusQueueOpen(true);
  }, [queueSessionSize]);

  const markContactedOptimistically = useCallback((contactId: string, patch: Partial<Contact> = {}) => {
    const today = getTodayISO();
    setRecentlyContacted(prev => {
      const next = new Map(prev);
      next.set(contactId, { ...(next.get(contactId) || {}), ...patch });
      return next;
    });
    markContactTouchedLocal(contactId, today);
    window.dispatchEvent(new CustomEvent('crm:whatsapp-sent', { detail: { contactId } }));
  }, [markContactTouchedLocal]);

  const whatsappPatch = useCallback((result: WhatsAppOperationalResult): Partial<Contact> => ({
    funnel_status: result.nextStage,
    next_action_text: 'Verificar resposta do cliente',
    next_action_date: result.followUpAt,
    next_contact_date: result.followUpAt,
  }), []);

  const refreshContactSignals = useCallback(() => {
    refreshNoResponse();
    refetchChecklists();
    refetchDaily();
  }, [refreshNoResponse, refetchChecklists, refetchDaily]);

  // Modo Fila — adiar próximo contato
  const handleQueueSnooze = useCallback(async (contact: Contact, when: number | string) => {
    try {
      await snoozeAttendance({ contactId: contact.id, when });
      toast.success('Atendimento adiado e próxima ação atualizada.');
      setTimeout(refreshContactSignals, 300);
    } catch { toast.error('Não foi possível adiar o atendimento.'); }
  }, [refreshContactSignals]);

  // Modo Fila — registrar resultado e transformar atendimento em próximo passo.
  const handleQueueDone = useCallback(async (contact: Contact, outcome: QueueOutcome): Promise<boolean> => {
    if (outcome === 'no_interest') {
      setFocusQueueOpen(false);
      setLostDialogContact(contact);
      return false;
    }

    markContactedOptimistically(contact.id);
    try {
      await applyAttendanceOutcome({ contactId: contact.id, outcome: outcome as AttendanceOutcome, observationSource: 'queue' });
    } catch {
      toast.error('Não foi possível registrar o resultado. O contato continuará na fila.');
      return false;
    }
    setTimeout(refreshContactSignals, 300);
    return true;
  }, [markContactedOptimistically, refreshContactSignals]);




  const handleAttend = useCallback((contact: Contact) => {
    if (viewMode === 'today') {
      sessionStorage.setItem('crm-attendance-queue', JSON.stringify({
        source: 'today',
        ids: filteredQueue.map(item => item.id),
      }));
    }
    navigate(`/contatos/inbox?contact=${contact.id}&attend=1`);
  }, [filteredQueue, navigate, viewMode]);

  const handleWhatsAppSend = async (message: string, templateLabel: string, attachments?: any[]) => {
    if (!whatsAppContact) return;
    const phone = whatsAppContact.whatsapp || whatsAppContact.mobile || whatsAppContact.phone;
    if (!phone) return;

    const contact = whatsAppContact;
    setWhatsAppContact(null);

    const hasAttachments = !!attachments?.length;
    const opened = hasAttachments
      ? await import('@/lib/whatsappShare').then(({ shareToWhatsApp }) => shareToWhatsApp({ phone, message, attachments: attachments! }))
      : openWhatsApp(phone, message);

    if (!opened) {
      if (!hasAttachments) toast.error('WhatsApp bloqueado pelo navegador. Libere pop-ups e tente novamente.');
      return;
    }

    // Atualização otimista: sai da lista e atualiza contadores imediatamente
    const registered = await logAndOpen({
      contactId: contact.id,
      contactName: contact.name,
      phone,
      message,
      templateLabel,
      source: 'crm_card',
      skipOpen: true,
    });
    if (registered) markContactedOptimistically(contact.id, whatsappPatch(registered));
    setTimeout(refreshContactSignals, 500);

  };

  const handleTempChange = async (contact: Contact, newTemp: string) => {
    if (contact.temperatura_lead === newTemp) return;
    const oldLabel = TEMP_CONFIG[contact.temperatura_lead as keyof typeof TEMP_CONFIG]?.label || contact.temperatura_lead;
    const newLabel = TEMP_CONFIG[newTemp as keyof typeof TEMP_CONFIG]?.label || newTemp;
    await addEntry(contact.id, 'stage_change', `Temperatura alterada de "${oldLabel}" para "${newLabel}"`, new Date().toISOString());
    await updateContact(contact.id, { temperatura_lead: newTemp });
    toast.success(`Temperatura alterada para ${newLabel}`);
  };

  const handleConfirmDelete = async () => {
    if (contactToDelete) {
      await deleteContact(contactToDelete.id);
      setDeleteDialogOpen(false);
      setContactToDelete(null);
    }
  };

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, contact: Contact) => {
    setDraggedContact(contact);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', contact.id);
  };

  const handleDragOver = (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageKey);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = async (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    setDragOverStage(null);
    if (draggedContact && draggedContact.funnel_status !== stageKey) {
      await handleStatusChange(draggedContact, stageKey);
    }
    setDraggedContact(null);
  };

  const handleSalesFunnelDrop = async (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    setDragOverStage(null);
    if (draggedContact && draggedContact.contact_type !== stageKey) {
      const oldLabel = SALES_FUNNEL_STAGES.find(s => s.key === draggedContact.contact_type)?.label || draggedContact.contact_type || 'Sem tipo';
      const newLabel = SALES_FUNNEL_STAGES.find(s => s.key === stageKey)?.label || stageKey;
      await addEntry(draggedContact.id, 'stage_change', `Tipo alterado de "${oldLabel}" para "${newLabel}"`, new Date().toISOString());
      await updateContact(draggedContact.id, { contact_type: stageKey });
      toast.success(`Movido para ${newLabel}`);
    }
    setDraggedContact(null);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />;
  };

  const TempBadge = ({ temp }: { temp?: string }) => {
    const cfg = TEMP_CONFIG[(temp || 'morno') as keyof typeof TEMP_CONFIG] || TEMP_CONFIG.morno;
    const Icon = cfg.icon;
    return (
      <span className={cn('inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold', cfg.className)}>
        <Icon className="h-2.5 w-2.5" />
        {cfg.label}
      </span>
    );
  };

  const FOLLOW_UP_LABELS: Record<string, string> = {
    mensagem: 'Mensagem', ligacao: 'Ligação', whatsapp: 'WhatsApp', reuniao: 'Reunião',
  };

  const getSmartMessage = useCallback((contact: Contact): { message: string; approach: string } => {
    const nrInfo = getNoResponseInfo(contact.id);
    const isClient = hasOrders(contact.id) || contact.contact_type === 'cliente_ativo';

    if (isClient) {
      return {
        message: `Olá${contact.name ? `, ${contact.name.split(' ')[0]}` : ''}! Tudo bem?\nEstamos com produção aberta essa semana, deseja fazer um novo pedido? 😊`,
        approach: 'Reativação de cliente ativo',
      };
    }

    if (nrInfo) {
      if (nrInfo.status === 'lead_esfriando' || nrInfo.status === 'follow_up_urgente') {
        return {
          message: `Olá${contact.name ? `, ${contact.name.split(' ')[0]}` : ''}! Tudo bem?\nQueria saber se ainda tem interesse, posso te ajudar a finalizar 😊`,
          approach: `Follow-up urgente (${nrInfo.daysSince}d sem resposta)`,
        };
      }
      if (nrInfo.status === 'sem_resposta') {
        return {
          message: `Oi${contact.name ? `, ${contact.name.split(' ')[0]}` : ''}! Tudo bem?\nSó passando para saber se conseguiu analisar o que conversamos 😊`,
          approach: `Follow-up leve (${nrInfo.daysSince}d sem resposta)`,
        };
      }
    }

    return {
      message: `Olá${contact.name ? `, ${contact.name.split(' ')[0]}` : ''}! Tudo bem?\nEstou entrando em contato para entender melhor seu pedido 😊`,
      approach: 'Primeiro contato / Lead novo',
    };
  }, [getNoResponseInfo, hasOrders]);

  const handleSmartAttend = useCallback(async (contact: Contact) => {
    const phone = contact.whatsapp || contact.mobile || contact.phone;
    if (!phone) return;

    const { message, approach } = getSmartMessage(contact);

    const opened = openWhatsApp(phone, message);
    if (!opened) {
      toast.error('WhatsApp bloqueado pelo navegador. Libere pop-ups e tente novamente.');
      return;
    }

    const registered = await logAndOpen({
      contactId: contact.id,
      contactName: contact.name,
      phone,
      message,
      approach,
      source: 'crm_smart_attend',
      skipOpen: true,
    });
    if (registered) markContactedOptimistically(contact.id, whatsappPatch(registered));
    setTimeout(refreshContactSignals, 500);

    toast.success(`⚡ Atendimento inteligente: ${approach}`);
  }, [getSmartMessage, logAndOpen, markContactedOptimistically, whatsappPatch, updateContact, refreshContactSignals]);

  const handleCreateOrder = useCallback((contact: Contact) => {
    const params = new URLSearchParams({
      tab: 'orders',
      newOrder: 'true',
      contactId: contact.id,
      contactName: contact.name || '',
      contactPhone: contact.phone || contact.whatsapp || contact.mobile || '',
      contactEmail: contact.email || '',
      ...(contact.notes ? { contactNotes: contact.notes } : {}),
    });
    navigate(`/operacoes?${params.toString()}`);
  }, [navigate]);

  const renderContactCard = useCallback((contact: Contact) => {
    const noResponseInfo = getNoResponseInfo(contact.id);
    const scoreInfo = getScore(contact.id);
    const phone = contact.whatsapp || contact.mobile || contact.phone;

    return (
      <ContactCard
        key={contact.id}
        contact={contact}
        urgencyLevel={getUrgencyLevel(contact)}
        noResponseInfo={noResponseInfo}
        hasOrders={hasOrders(contact.id)}
        checklistData={checklistMap[contact.id]}
        scoreInfo={scoreInfo}
        isDragged={draggedContact?.id === contact.id}
        hasPhone={!!phone}
        nextTaskDate={nextTaskByContact[contact.id] || null}
        convoSummary={convoSummaryByContact[contact.id]}
        onEdit={() => { setDetailContact(contact); setDetailOpen(true); }}
        onWhatsApp={() => handleAttend(contact)}
        onViewOrders={() => { setHistoryContact(contact); setHistoryOpen(true); }}
        onViewHistory={() => { setTimelineContact(contact); setTimelineOpen(true); }}
        onViewActivities={() => { setActivitiesContact(contact); setActivitiesOpen(true); }}
        onCreateOrder={() => handleCreateOrder(contact)}
        onDelete={() => { setContactToDelete(contact); setDeleteDialogOpen(true); }}
        onTempChange={(temp) => handleTempChange(contact, temp)}
        onDragStart={(e) => handleDragStart(e, contact)}
        onFollowUp={async (type, note) => {
          const now = new Date().toISOString();
          const desc = `[${FOLLOW_UP_LABELS[type] || type}] ${note}`;
          await addEntry(contact.id, type, desc, now);
          setTimeout(refreshContactSignals, 500);
        }}
        onSendSuggestion={async () => {
          if (!phone || !noResponseInfo) return;
          const opened = openWhatsApp(phone, noResponseInfo.suggestedMessage);
          if (!opened) {
            toast.error('WhatsApp bloqueado pelo navegador. Libere pop-ups e tente novamente.');
            return;
          }
          markContactedOptimistically(contact.id);
          void logAndOpen({
            contactId: contact.id,
            contactName: contact.name,
            phone,
            message: noResponseInfo.suggestedMessage,
            approach: noResponseInfo.suggestedLabel,
            source: 'crm_follow_up',
            skipOpen: true,
          }).finally(() => setTimeout(refreshContactSignals, 500));
        }}
      />
    );
  }, [getUrgencyLevel, getNoResponseInfo, getScore, hasOrders, checklistMap, draggedContact, handleAttend, handleTempChange, addEntry, refreshContactSignals, handleCreateOrder, logAndOpen, markContactedOptimistically, convoSummaryByContact]);


  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b px-3 py-1.5 space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold flex items-center gap-1.5">
            <UserPlus className="h-4 w-4 text-primary" />
            Contatos
          </h1>
          <div className="relative hidden min-w-52 max-w-sm flex-1 md:block">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Buscar contatos no CRM"
              placeholder="Buscar contato, telefone ou Instagram…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-8 bg-muted/40 pl-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(queueSessionSize)} onValueChange={(value) => setQueueSessionSize(Number(value))}>
              <SelectTrigger className="hidden h-8 w-[118px] text-xs lg:flex" aria-label="Tamanho da sessão de atendimento">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">Sessão: 10</SelectItem>
                <SelectItem value="20">Sessão: 20</SelectItem>
                <SelectItem value="30">Sessão: 30</SelectItem>
              </SelectContent>
            </Select>
            <Link to="/contatos/tarefas">
              <Button variant="outline" size="sm" className="h-8 gap-1 px-2.5">
                <CalendarClock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Tarefas agendadas</span>
                <span className="sm:hidden">Tarefas</span>
              </Button>
            </Link>
            <Link to="/contatos/inbox">
              <Button variant="outline" size="sm" className="h-8 gap-1 px-2.5">
                <MessageCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Caixa de entrada</span>
                <span className="sm:hidden">Inbox</span>
              </Button>
            </Link>
            <Button variant="outline" size="sm" className="h-8 px-2.5" onClick={() => setTagsManagerOpen(true)}>
              <Tag className="h-3.5 w-3.5 mr-1" />
              Tags
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-2.5" onClick={() => setImportOpen(true)}>
              <Users className="h-3.5 w-3.5 mr-1" />
              Importar Leads
            </Button>
            <Button onClick={() => { void openContactForm(); }} size="sm" className="h-8 bg-green-600 hover:bg-green-700 shadow-sm">
              <Plus className="h-4 w-4 mr-1" />
              Novo
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Buscar contatos no CRM"
              placeholder="Buscar contato ou telefone…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-8 bg-muted/40 pl-8 text-xs"
            />
          </div>
          <Select value={String(queueSessionSize)} onValueChange={(value) => setQueueSessionSize(Number(value))}>
            <SelectTrigger className="h-8 w-[110px] text-xs" aria-label="Tamanho da sessão de atendimento">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">Sessão: 10</SelectItem>
              <SelectItem value="20">Sessão: 20</SelectItem>
              <SelectItem value="30">Sessão: 30</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Indicadores — painel único do CRM */}
        <CrmIndicatorsPanel dailyMetrics={dailyMetrics} followUpHoje={metrics.followUpHoje} />




        <CrmAutomationHub
          attentionFilter={attentionFilter}
          setAttentionFilter={setAttentionFilter}
          counts={attentionCounts}
          resultCount={filteredContacts.length}
          queue={filteredQueue}
          activeFilterCount={[
            !!searchQuery,
            typeFilter !== 'all',
            statusFilter !== 'all',
            classificationFilter !== 'all',
            tagFilter !== 'all',
            originFilter !== 'all',
            tempFilter !== 'all',
            actionFilter !== 'all',
            contactDateFilter !== 'all',
            cityFilter !== 'all',
            responsibleFilter !== 'all',
            purchaseFilter !== 'all',
            paidOrdersFilter !== 'all',
            reactivationFilter !== 'all',
          ].filter(Boolean).length}
          onClearAllFilters={() => {
            setSearchQuery('');
            setTypeFilter('all');
            setStatusFilter('all');
            setClassificationFilter('all');
            setTagFilter('all');
            setOriginFilter('all');
            setTempFilter('all');
            setActionFilter('all');
            setContactDateFilter('all');
            setCityFilter('all');
            setResponsibleFilter('all');
            setPurchaseFilter('all');
            setPaidOrdersFilter('all');
            setReactivationFilter('all');
            setCommercialOptOutFilter('all');
            setAttentionFilter('all');
            setQualityOnly(false);
          }}
          filtersSlot={(
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="cliente">Clientes</SelectItem>
                  <SelectItem value="fornecedor">Fornecedores</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {FUNNEL_STAGES.map(s => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={classificationFilter} onValueChange={setClassificationFilter}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="Classificação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas classif.</SelectItem>
                  {Object.entries(CLIENT_CLASSIFICATION_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-1.5">{cfg.emoji} {cfg.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {tags.length > 0 && (
                <Select value={tagFilter} onValueChange={setTagFilter}>
                  <SelectTrigger className="w-32 h-9">
                    <SelectValue placeholder="Tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas tags</SelectItem>
                    {tags.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                          {t.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {segmentationMode && (
                <>
                  <Select value={cityFilter} onValueChange={setCityFilter}>
                    <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Cidade" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas cidades</SelectItem>
                      {Array.from(new Set(contacts.map(c => (c.city || '').trim()).filter(Boolean))).sort().map(city => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
                    <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Responsável" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos responsáveis</SelectItem>
                      {Array.from(new Set(contacts.map(c => (c.salesperson || '').trim()).filter(Boolean))).sort().map(person => (
                        <SelectItem key={person} value={person}>{person}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={purchaseFilter} onValueChange={(value) => setPurchaseFilter(value as PurchaseFilter)}>
                    <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Última compra" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas compras</SelectItem>
                      <SelectItem value="with_purchase">Com compra</SelectItem>
                      <SelectItem value="never">Nunca comprou</SelectItem>
                      <SelectItem value="last_15">Comprou até 15d</SelectItem>
                      <SelectItem value="last_30">Comprou até 30d</SelectItem>
                      <SelectItem value="last_60">Comprou até 60d</SelectItem>
                      <SelectItem value="last_90">Comprou até 90d</SelectItem>
                      <SelectItem value="over_90">Mais de 90d</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={paidOrdersFilter} onValueChange={(value) => setPaidOrdersFilter(value as PaidOrdersFilter)}>
                    <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Pedidos pagos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Pedidos pagos</SelectItem>
                      <SelectItem value="one_plus">1 ou mais</SelectItem>
                      <SelectItem value="two_plus">2 ou mais</SelectItem>
                      <SelectItem value="three_plus">3 ou mais</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={reactivationFilter} onValueChange={(value) => setReactivationFilter(value as ReactivationFilter)}>
                    <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Reativação" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toda reativação</SelectItem>
                      <SelectItem value="scheduled">Com reativação</SelectItem>
                      <SelectItem value="overdue">Reativação vencida</SelectItem>
                      <SelectItem value="none">Sem reativação</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={commercialOptOutFilter} onValueChange={(value) => setCommercialOptOutFilter(value as CommercialOptOutFilter)}>
                    <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Contato comercial" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os contatos</SelectItem>
                      <SelectItem value="eligible">Pode receber contato</SelectItem>
                      <SelectItem value="opted_out">Não deseja contato</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}

              {(() => {
                const origins = Array.from(new Set(
                  contacts
                    .filter(c => c.is_active)
                    .map(c => (c.origem_lead || 'Não Informado').trim())
                    .filter(Boolean)
                )).sort();
                if (origins.length === 0) return null;
                return (
                  <Select value={originFilter} onValueChange={setOriginFilter}>
                    <SelectTrigger className="w-40 h-9">
                      <SelectValue placeholder="Origem" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas origens</SelectItem>
                      {origins.map(o => (
                        <SelectItem key={o} value={o}>
                          {o.startsWith('Campanha:') ? `📣 ${o.replace(/^Campanha:\s*/, '')}` : o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              })()}

              <Select value={`${sortField}-${sortDir}`} onValueChange={(v) => {
                const [f, d] = v.split('-') as [SortField, SortDir];
                setSortField(f);
                setSortDir(d);
              }}>
                <SelectTrigger className="w-40 h-9">
                  <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Nome A→Z</SelectItem>
                  <SelectItem value="name-desc">Nome Z→A</SelectItem>
                  <SelectItem value="temperatura-desc">Temp. ↑ Quente</SelectItem>
                  <SelectItem value="temperatura-asc">Temp. ↓ Frio</SelectItem>
                  <SelectItem value="ultimo_contato-asc">Últ. Contato ↑ Antigo</SelectItem>
                  <SelectItem value="ultimo_contato-desc">Últ. Contato ↓ Recente</SelectItem>
                  <SelectItem value="valor_estimado-desc">Valor ↓ Maior</SelectItem>
                  <SelectItem value="score-desc">Score ↓ Maior</SelectItem>
                  <SelectItem value="created_at-desc">Mais recente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          onStartQueue={startFocusSession}
          leadsPanelSlot={(
            <LeadsNeedContactPanel
              contacts={filteredQueue}
              preFiltered
              filterLabel={attentionFilter === 'all' ? 'Fila de atenção' : ATTENTION_LABELS[attentionFilter]}
              onOpenContact={(contact) => { setDetailContact(contact); setDetailOpen(true); }}
              onWhatsApp={handleAttend}
              onBulkDispatch={(list) => setBulkDispatchContacts(list)}
              getUrgencyLevel={getUrgencyLevel}
              getUrgencyReason={getContactUrgencyReason}
            />
          )}
        />

        <CrmFocusQueue
          open={focusQueueOpen}
          onOpenChange={setFocusQueueOpen}
          queue={focusQueue}
          getUrgencyLevel={getUrgencyLevel}
          getUrgencyReason={getContactUrgencyReason}
          onWhatsApp={handleAttend}
          onSnooze={handleQueueSnooze}
          onDone={handleQueueDone}
          onOpenContact={(contact) => { setDetailContact(contact); setDetailOpen(true); }}
        />


        {/* Ações e visualização */}
        <div className="flex items-center gap-2 justify-end flex-wrap">
          <Button
            variant={segmentationMode ? 'secondary' : 'outline'}
            size="sm"
            className={cn('h-8 gap-1.5', segmentationMode && 'border-primary/30 bg-primary/10 text-primary')}
            onClick={() => {
              const next = !segmentationMode;
              setSegmentationMode(next);
              if (next) {
                setViewMode('list');
                setAttentionFilter('all');
                setQualityOnly(false);
              }
            }}
            title="Filtrar a base comercial sem alterar a Caixa de Entrada"
          >
            <Filter className="h-3.5 w-3.5" />
            <span className="text-xs">Segmentar{segmentationMode ? ` (${filteredContacts.length})` : ''}</span>
          </Button>
          <Button
            variant={qualityOnly ? 'secondary' : 'outline'}
            size="sm"
            className={cn('h-8 gap-1.5', qualityOnly && 'border-amber-300 bg-amber-100 text-amber-800')}
            onClick={() => {
              const next = !qualityOnly;
              setQualityOnly(next);
              if (next) {
                setAttentionFilter('all');
                setViewMode('list');
              }
            }}
            title="Contatos com telefone ausente, nome inválido ou possível duplicidade"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-xs">Qualidade ({qualityIssueByContact.size})</span>
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setPosVendaOpen(true)} title="Pós-Venda">
            <Heart className="h-4 w-4 text-pink-600" />
            <span className="hidden sm:inline text-xs">Pós-Venda</span>
          </Button>

          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setAutomationsOpen(true)} title="Automações do Funil">
            <Zap className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline text-xs">Automações</span>
          </Button>

          <div className="flex border rounded-lg overflow-hidden">
            {/* FRENTE 7A — "Hoje no CRM" e o funil legado por contact_type saíram da barra
                para não duplicar a Caixa de Entrada nem a etapa comercial oficial. */}
            <Button variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none" onClick={() => setViewMode('kanban')} title="Kanban">
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'funnel' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none border-x" onClick={() => setViewMode('funnel')} title="Análise Funil">
              <Triangle className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none" onClick={() => setViewMode('list')} title="Lista">
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        {segmentationMode && (
          <Card className="mb-3 border-primary/20 bg-primary/[0.03] px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Segmentação comercial</p>
                <p className="text-xs text-muted-foreground">Use filtros combinados para encontrar grupos. Esta seleção não coloca contatos na Inbox.</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-sm">Resultado: {filteredContacts.length} contatos</Badge>
                <Button
                  size="sm"
                  className="h-8 gap-1.5"
                  disabled={filteredContacts.length === 0}
                  onClick={() => setCampaignCreateOpen(true)}
                >
                  <Megaphone className="h-4 w-4" />
                  <span className="text-xs">Criar campanha com este segmento</span>
                </Button>
              </div>
            </div>
          </Card>
        )}

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ) : viewMode === 'today' ? (
          <CrmTodayView
            queue={filteredQueue}
            counts={attentionCounts}
            activeFilter={attentionFilter}
            getUrgencyReason={getContactUrgencyReason}
            onSelectFilter={(filter) => {
              setQualityOnly(false);
              setAttentionFilter(current => current === filter ? 'all' : filter);
            }}
            onStartQueue={() => startFocusSession(filteredQueue)}
            onOpenContact={(contact) => { setDetailContact(contact); setDetailOpen(true); }}
            onWhatsApp={handleAttend}
          />
        ) : viewMode === 'kanban' ? (
          <div className="flex gap-0 overflow-x-auto">
            {FUNNEL_STAGES.map((stage) => {
              const stageContacts = groupedByStage[stage.key] || [];
              const stageSum = stageSums[stage.key] || 0;
              const isDragOver = dragOverStage === stage.key;
              return (
                <div
                  key={stage.key}
                  className={cn(
                    'flex flex-col w-[290px] flex-shrink-0 border-r border-border/60 bg-transparent transition-colors',
                    isDragOver && 'bg-primary/5',
                  )}
                  onDragOver={(e) => handleDragOver(e, stage.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, stage.key)}
                >
                  {/* Kommo-style column header */}
                  <div className="px-3 pt-3 pb-2 text-center bg-background sticky top-0 z-10">
                    <div className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">{stage.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {stageContacts.length} leads: {formatCurrencyShort(stageSum)}
                    </div>
                    <div className={cn('h-[3px] mt-2 rounded-full', stage.color)} />
                  </div>

                  <VirtualContactColumn
                    contacts={stageContacts}
                    renderContact={renderContactCard}
                    emptyLabel="Sem leads"
                    dragOverLabel="Soltar aqui"
                    isDragOver={isDragOver}
                  />
                </div>
              );
            })}
          </div>
        ) : viewMode === 'sales_funnel' ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SALES_FUNNEL_STAGES.map((stage) => {
              const stageContacts = groupedBySalesFunnel[stage.key] || [];
              const stageSum = salesFunnelSums[stage.key];
              const isDragOver = dragOverStage === stage.key;
              return (
                <div
                  key={stage.key}
                  className="min-w-[200px]"
                  onDragOver={(e) => handleDragOver(e, stage.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleSalesFunnelDrop(e, stage.key)}
                >
                  <div className={cn(
                    "rounded-xl p-2.5 mb-2 transition-all",
                    isDragOver ? "ring-2 ring-primary ring-offset-1 shadow-lg" : "",
                    stage.headerBg,
                  )}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white drop-shadow-sm">{stage.emoji} {stage.label}</span>
                      <Badge className="bg-white/30 text-white border-0 text-xs h-5 px-1.5 font-bold backdrop-blur-sm">
                        {stageContacts.length}
                      </Badge>
                    </div>
                    {stageSum > 0 && (
                      <p className="text-[11px] font-bold text-white/90 mt-1 drop-shadow-sm">
                        {formatCurrencyShort(stageSum)}
                      </p>
                    )}
                    <div className="mt-1.5 h-1 rounded-full bg-white/20 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-white/60 transition-all"
                        style={{ width: `${Math.min(100, (stageContacts.length / Math.max(filteredContacts.length, 1)) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <VirtualContactColumn
                    contacts={stageContacts}
                    renderContact={renderContactCard}
                    emptyLabel="Nenhum contato"
                    dragOverLabel="Soltar aqui"
                    isDragOver={isDragOver}
                    className={cn('rounded-lg transition-colors p-0.5 max-h-[calc(100vh-380px)]', isDragOver && 'bg-primary/5')}
                  />
                </div>
              );
            })}
          </div>
        ) : viewMode === 'funnel' ? (
          <Suspense fallback={<div className="p-8 text-center text-muted-foreground text-sm">Carregando funil…</div>}>
            <KommoFunnelView
              contacts={filteredContacts}
              nextTaskByContact={nextTaskByContact}
              onLeadClick={(c) => { setDetailContact(c); setDetailOpen(true); }}
              onStageChange={(c, newStage) => handleStatusChange(c, newStage)}
              onCreateLead={() => { void openContactForm(); }}
            />
          </Suspense>


        ) : (
          <Card className="overflow-hidden">
            {qualityOnly && (
              <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span><strong>{filteredContacts.length}</strong> contatos precisam de revisão cadastral. Corrija o motivo exibido abaixo do nome.</span>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>
                    <div className="flex items-center">Nome <SortIcon field="name" /></div>
                  </TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Classificação</TableHead>
                  <TableHead>Tipo</TableHead>
                  {segmentationMode && <>
                    <TableHead>Pedidos pagos</TableHead>
                    <TableHead>Última compra</TableHead>
                    <TableHead>Reativação</TableHead>
                  </>}
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('temperatura')}>
                    <div className="flex items-center">Temp. <SortIcon field="temperatura" /></div>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('valor_estimado')}>
                    <div className="flex items-center">Valor Est. <SortIcon field="valor_estimado" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('ultimo_contato')}>
                    <div className="flex items-center">Últ. Contato <SortIcon field="ultimo_contato" /></div>
                  </TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Resposta</TableHead>
                  <TableHead>Próxima Ação</TableHead>
                  <TableHead>Próx. Contato</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={segmentationMode ? 18 : 15} className="text-center text-muted-foreground py-12">
                      Nenhum contato encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedContacts.map((contact) => {
                    const alert = getUltimoContatoAlert(contact.ultimo_contato);
                    const contactTags = getTagsForContact(contact.id);
                    return (
                      <TableRow key={contact.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ContactAvatar photoUrl={contact.photo_url} name={contact.name} size="sm" />
                            <div>
                              <span className="text-primary hover:underline cursor-pointer font-medium" onClick={() => { void openContactForm(contact); }}>
                                {contact.name}
                              </span>
                              {contact.fantasy_name && <p className="text-xs text-muted-foreground">{contact.fantasy_name}</p>}
                              {qualityOnly && qualityIssueByContact.has(contact.id) && (
                                <p className="max-w-64 text-[10px] font-medium text-amber-700">
                                  {qualityIssueByContact.get(contact.id)?.join(' · ')}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const ul = getUrgencyLevel(contact);
                            const ucfg = URGENCY_LEVELS[ul];
                            return (
                              <span className={cn('inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold', ucfg.className)}>
                                {ucfg.emoji} {ucfg.label}
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {contact.client_classification && CLIENT_CLASSIFICATION_CONFIG[contact.client_classification] ? (
                            <span className={cn('inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold', CLIENT_CLASSIFICATION_CONFIG[contact.client_classification].className)}>
                              {CLIENT_CLASSIFICATION_CONFIG[contact.client_classification].emoji} {CLIENT_CLASSIFICATION_CONFIG[contact.client_classification].label}
                            </span>
                          ) : <span className="text-muted-foreground text-xs">-</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {contact.type === 'ambos' ? 'Ambos' : contact.type === 'fornecedor' ? 'Fornecedor' : 'Cliente'}
                          </Badge>
                          {hasOrders(contact.id) && (
                            <span className="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-400 dark:border-green-700">
                              <ShoppingCart className="h-2.5 w-2.5" />
                              Cliente
                            </span>
                          )}
                        </TableCell>
                        {segmentationMode && <>
                          <TableCell className="text-xs font-medium">{contact.paid_orders_count || 0}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {contact.last_purchase_date ? (() => {
                              const days = daysSince(contact.last_purchase_date);
                              return days === null ? '-' : `${days}d atrás`;
                            })() : 'Nunca comprou'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {reactivationByContact[contact.id] ? (() => {
                              const days = daysSince(reactivationByContact[contact.id]);
                              return days === null ? '-' : days < 0 ? `Em ${Math.abs(days)}d` : days === 0 ? 'Hoje' : `${days}d vencida`;
                            })() : '-'}
                          </TableCell>
                        </>}
                        <TableCell>
                          <Select value={contact.temperatura_lead || 'morno'} onValueChange={(v) => handleTempChange(contact, v)}>
                            <SelectTrigger className="h-7 text-xs w-28 border-0 bg-transparent p-0 shadow-none">
                              <TempBadge temp={contact.temperatura_lead} />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(TEMP_CONFIG).map(([key, cfg]) => {
                                const Icon = cfg.icon;
                                return (
                                  <SelectItem key={key} value={key}>
                                    <span className="flex items-center gap-1.5">
                                      <Icon className="h-3 w-3" />
                                      {cfg.label}
                                    </span>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select value={contact.funnel_status || 'novo_lead'} onValueChange={(v) => handleStatusChange(contact, v)}>
                            <SelectTrigger className="h-7 text-xs w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FUNNEL_STAGES.map(s => (
                                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{formatCurrencyShort(contact.valor_estimado) || '-'}</TableCell>
                        <TableCell>
                          {alert ? (
                            <span className={cn('text-xs font-medium rounded px-1.5 py-0.5 border', alert.className)}>{alert.label}</span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const si = getScore(contact.id);
                            return (
                              <span className={cn('inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-bold', si.className)}>
                                {si.emoji} {si.score}
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const nrInfo = getNoResponseInfo(contact.id);
                            if (!nrInfo) return <span className="text-muted-foreground text-xs">-</span>;
                            return (
                              <div className="flex items-center gap-1.5">
                                <span className={cn(
                                  'text-[10px] font-semibold rounded-full px-1.5 py-0.5 border inline-flex items-center gap-0.5',
                                  nrInfo.status === 'follow_up_urgente' && 'bg-red-100 text-red-700 border-red-300',
                                  nrInfo.status === 'sem_resposta' && 'bg-amber-100 text-amber-700 border-amber-300',
                                  nrInfo.status === 'lead_esfriando' && 'bg-sky-100 text-sky-700 border-sky-300',
                                )}>
                                  {nrInfo.emoji} {nrInfo.daysSince}d
                                </span>
                                {(contact.whatsapp || contact.mobile || contact.phone) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                    title="Enviar sugestão via WhatsApp"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const phone = contact.whatsapp || contact.mobile || contact.phone;
                                      if (!phone) return;
                                      const now = new Date().toISOString();
                                      await addEntry(contact.id, 'whatsapp', `💬 Follow-up enviado automaticamente (sugerido pelo sistema · ${nrInfo.suggestedLabel})`, now);
                                      openWhatsApp(phone, nrInfo.suggestedMessage);
                                      markContactedOptimistically(contact.id);
                                      setTimeout(refreshContactSignals, 500);
                                    }}
                                  >
                                    <Send className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {contact.next_action_text || contact.next_action_date ? (
                            <div className={cn("text-xs", isNextActionOverdue(contact) && "text-red-600 font-semibold")}>
                              {isNextActionOverdue(contact) && <AlertTriangle className="h-3 w-3 inline mr-0.5 -mt-0.5" />}
                              {contact.next_action_text && <span className="block truncate max-w-[120px]">{contact.next_action_text}</span>}
                              {contact.next_action_date && (
                                <span className="text-[10px] text-muted-foreground">
                                  {(() => { try { return format(parseISO(contact.next_action_date), "dd/MM HH:mm"); } catch { return '-'; } })()}
                                </span>
                              )}
                            </div>
                          ) : <span className="text-muted-foreground text-xs">-</span>}
                        </TableCell>
                        <TableCell>
                          {contact.next_contact_date ? (() => {
                            const ncs = getNextContactStatus(contact.next_contact_date);
                            if (!ncs) return <span className="text-muted-foreground text-xs">-</span>;
                            const timeStr = (() => { try { return format(parseISO(contact.next_contact_date), "dd/MM HH:mm"); } catch { return ''; } })();
                            return (
                              <span className={cn("text-[10px] font-semibold rounded px-1.5 py-0.5 border inline-flex items-center gap-1", ncs.className)}>
                                {ncs.isOverdue && <AlertTriangle className="h-3 w-3" />}
                                <Phone className="h-3 w-3" />
                                {timeStr}
                              </span>
                            );
                          })() : <span className="text-muted-foreground text-xs">-</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-0.5 flex-wrap">
                            {contactTags.slice(0, 2).map(tag => (
                              <span key={tag.id} className="text-[9px] font-medium rounded-full px-1.5 py-0.5 text-white" style={{ backgroundColor: tag.color }}>
                                {tag.name}
                              </span>
                            ))}
                            {contactTags.length > 2 && <span className="text-[9px] text-muted-foreground">+{contactTags.length - 2}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{contact.origem_lead || '-'}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { void openContactForm(contact); }}>
                                <Edit className="h-3.5 w-3.5 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setActivitiesContact(contact); setActivitiesOpen(true); }}>
                                <CalendarClock className="h-3.5 w-3.5 mr-2" />
                                Atividades
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setTimelineContact(contact); setTimelineOpen(true); }}>
                                <History className="h-3.5 w-3.5 mr-2" />
                                Timeline
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setHistoryContact(contact); setHistoryOpen(true); }}>
                                <ShoppingCart className="h-3.5 w-3.5 mr-2" />
                                Pedidos
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCreateOrder(contact)} className="text-green-700 dark:text-green-500 font-medium">
                                <ShoppingCart className="h-3.5 w-3.5 mr-2" />
                                Novo Pedido
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Temperatura</div>
                              {Object.entries(TEMP_CONFIG).filter(([key]) => key !== contact.temperatura_lead).map(([key, cfg]) => {
                                const Icon = cfg.icon;
                                return (
                                  <DropdownMenuItem key={key} onClick={() => handleTempChange(contact, key)}>
                                    <Icon className="h-3.5 w-3.5 mr-2" />
                                    {cfg.label}
                                  </DropdownMenuItem>
                                );
                              })}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => { setContactToDelete(contact); setDeleteDialogOpen(true); }} className="text-destructive">
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            {sortedContacts.length > 0 && (
              <div className="flex flex-col gap-2 border-t bg-muted/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Exibindo {(listPage - 1) * LIST_PAGE_SIZE + 1}–{Math.min(listPage * LIST_PAGE_SIZE, sortedContacts.length)} de {sortedContacts.length} contatos
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={listPage === 1}
                    onClick={() => setListPage(page => Math.max(1, page - 1))}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Anterior
                  </Button>
                  <span className="min-w-20 text-center text-xs font-medium">
                    Página {listPage} de {listPageCount}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={listPage === listPageCount}
                    onClick={() => setListPage(page => Math.min(listPageCount, page + 1))}
                  >
                    Próxima
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Dialogs lazy — só carregam quando abertos */}
      <Suspense fallback={null}>
        {formOpen && (
          <ContactFormDialog open={formOpen} onOpenChange={setFormOpen} contact={editingContact} onSave={handleSave} />
        )}

        {detailOpen && (
          <LeadDetailDrawer
            open={detailOpen}
            onOpenChange={setDetailOpen}
            contact={(detailContact && contacts.find(c => c.id === detailContact.id)) || detailContact || null}
            onSave={updateContact}
            onOpenFull={() => {
              const contact = (detailContact && contacts.find(c => c.id === detailContact.id)) || detailContact;
              setDetailOpen(false);
              if (contact) void openContactForm(contact);
            }}
          />
        )}

        {automationsOpen && (
          <Dialog open={automationsOpen} onOpenChange={setAutomationsOpen}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <FunnelAutomationsPanel onClose={() => setAutomationsOpen(false)} />
            </DialogContent>
          </Dialog>
        )}

        {posVendaOpen && (
          <PosVendaPanel open={posVendaOpen} onOpenChange={setPosVendaOpen} />
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir "{contactToDelete?.name}"?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {historyOpen && (
          <ContactOrderHistory open={historyOpen} onOpenChange={setHistoryOpen} contact={historyContact} />
        )}

        {timelineOpen && (
          <ContactHistoryDialog
            open={timelineOpen}
            onOpenChange={setTimelineOpen}
            contactId={timelineContact?.id || null}
            contactName={timelineContact?.name || ''}
          />
        )}

        {tagsManagerOpen && (
          <ContactTagsManager open={tagsManagerOpen} onOpenChange={setTagsManagerOpen} />
        )}

        {importOpen && (
          <LeadImportDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            funnelStages={FUNNEL_STAGES.map(s => ({ key: s.key, label: s.label }))}
            onImported={fetchContacts}
          />
        )}

        {activitiesOpen && (
          <ContactActivitiesPanel
            open={activitiesOpen}
            onOpenChange={setActivitiesOpen}
            contact={activitiesContact}
          />
        )}

        {!!whatsAppContact && (
          <WhatsAppMessageSelector
            open={!!whatsAppContact}
            onOpenChange={(open) => { if (!open) setWhatsAppContact(null); }}
            contactName={whatsAppContact?.name || ''}
            funnelStatus={whatsAppContact?.funnel_status || ''}
            contactId={whatsAppContact?.id}
            onSend={handleWhatsAppSend}
          />
        )}

        {!!bulkDispatchContacts && (
          <BulkWhatsAppDispatch
            open={!!bulkDispatchContacts}
            onOpenChange={(open) => { if (!open) setBulkDispatchContacts(null); }}
            contacts={bulkDispatchContacts || []}
            onFinished={(contact, result) => {
              if (contact) markContactedOptimistically(contact.id, result ? whatsappPatch(result) : {});
              refreshContactSignals();
            }}
          />
        )}

        {!!lostDialogContact && (
          <LostReasonDialog
            open={!!lostDialogContact}
            contactName={lostDialogContact?.name}
            onCancel={() => setLostDialogContact(null)}
            onConfirm={handleConfirmLost}
          />
        )}
        {campaignCreateOpen && (
          <CampaignCreateDialog
            open={campaignCreateOpen}
            onOpenChange={setCampaignCreateOpen}
            contacts={filteredContacts}
            segmentFilters={{
              search: deferredSearchQuery || null,
              statusFilter, tempFilter, typeFilter, tagFilter, actionFilter,
              contactDateFilter, classificationFilter, originFilter, cityFilter,
              responsibleFilter, purchaseFilter, paidOrdersFilter,
              reactivationFilter, commercialOptOutFilter, attentionFilter,
              qualityOnly,
            }}
            onCreated={async (campaignId) => {
              const { data } = await (supabase as any).from('crm_campaigns').select('*').eq('id', campaignId).single();
              if (data) setCampaignReview(data as CrmCampaign);
            }}
          />
        )}

        {!!campaignReview && (
          <CampaignReviewDialog
            open={!!campaignReview}
            onOpenChange={(open) => { if (!open) setCampaignReview(null); }}
            campaign={campaignReview}
          />
        )}
      </Suspense>


    </div>
  );
}
