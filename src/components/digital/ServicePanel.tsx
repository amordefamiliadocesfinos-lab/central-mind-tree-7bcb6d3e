import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useServiceChat, ServiceConversation, ServiceMessage, SalesChannelEntry } from '@/hooks/useServiceChat';
import { usePlatforms } from '@/hooks/usePlatforms';
import { useContacts } from '@/hooks/useContacts';
import { PlatformIcon } from './PlatformsManager';
import { ContactAutocomplete } from '@/components/operations/ContactAutocomplete';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import {
  MessageCircle, X, Loader2, ArrowLeft, ChevronRight, User,
  Bot, Copy, Link2, ExternalLink, Crown, Search,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { CRM_FUNNEL_STAGES, normalizeCrmStage } from '@/lib/crm/model';

const FUNNEL_STAGES = Object.fromEntries(CRM_FUNNEL_STAGES.map((stage, index) => [
  stage.key,
  {
    label: stage.label,
    color: ['bg-blue-500', 'bg-cyan-500', 'bg-yellow-500', 'bg-orange-500', 'bg-green-500', 'bg-emerald-500', 'bg-violet-500', 'bg-slate-500'][index],
  },
])) as Record<string, { label: string; color: string }>;

export function ServicePanel() {
  const {
    conversations, messages, activeConversationId, loading,
    messagesLoading, selectConversation,
    linkConversationToCrmContact, updateDigitalChannelContext,
  } = useServiceChat();
  const { activePlatforms } = usePlatforms();
  const { contacts } = useContacts();
  const isMobile = useIsMobile();

  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Etapa 5: deep-link via ?conversation=<id> (vindo do CRM/Caixa de Entrada)
  useEffect(() => {
    const cid = searchParams.get('conversation');
    if (cid && conversations.some(c => c.id === cid)) {
      selectConversation(cid);
      if (isMobile) setShowMobileChat(true);
      const next = new URLSearchParams(searchParams);
      next.delete('conversation');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations.length]);

  const activeConv = conversations.find(c => c.id === activeConversationId);
  const linkedContact = activeConv?.contact_id ? contacts.find(c => c.id === activeConv.contact_id) : null;

  const filteredConversations = conversations.filter(c => {
    if (filterPlatform !== 'all' && c.platform_id !== filterPlatform) return false;
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const contact = c.contact_id ? contacts.find(x => x.id === c.contact_id) : null;
      const hay = [
        c.contact_name,
        c.contact_handle,
        c.last_message_preview,
        contact?.name,
        contact?.whatsapp,
        contact?.phone,
        (contact as any)?.email,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const getPlatform = (id: string | null) => {
    if (!id) return null;
    return activePlatforms.find(p => p.id === id);
  };

  const handleSelectConv = (id: string) => {
    selectConversation(id);
    if (isMobile) setShowMobileChat(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Platform sidebar items
  const platformCounts = activePlatforms.map(p => ({
    ...p,
    count: conversations.filter(c => c.platform_id === p.id && c.status === 'open').length,
  }));
  const totalOpen = conversations.filter(c => c.status === 'open').length;

  // Mobile: show chat view
  if (isMobile && showMobileChat && activeConv) {
    return (
      <div className="flex flex-col h-[calc(100vh-180px)]">
        <ChatHeader
          conversation={activeConv}
          platform={getPlatform(activeConv.platform_id)}
          linkedContact={linkedContact}
          onLinkContact={(cid) => linkConversationToCrmContact(activeConv.id, cid)}
          onBack={() => { setShowMobileChat(false); selectConversation(null); }}
          onUpdateDigitalChannelContext={(channels) => updateDigitalChannelContext(activeConv.id, channels)}
          platforms={activePlatforms}
        />
        <ChatMessages
          messages={messages}
          loading={messagesLoading}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros da visão de contexto digital. Atendimento comercial é centralizado na Inbox CRM. */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[120px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="open">Abertas</SelectItem>
            <SelectItem value="closed">Fechadas</SelectItem>
            <SelectItem value="archived">Arquivadas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterPlatform} onValueChange={setFilterPlatform}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Plataforma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas ({totalOpen})</SelectItem>
            {platformCounts.map(p => (
              <SelectItem key={p.id} value={p.id}>
                <span className="flex items-center gap-1"><PlatformIcon icon={p.icon} size="sm" /> {p.name} ({p.count})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

      </div>

      {/* 3-panel layout (desktop) / list (mobile) */}
      {isMobile ? (
        <ConversationList
          conversations={filteredConversations}
          platforms={activePlatforms}
          activeId={activeConversationId}
          onSelect={handleSelectConv}
        />
      ) : (
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-280px)] min-h-[500px]">
          {/* Platform sidebar */}
          <div className="col-span-2 border rounded-lg overflow-hidden">
            <div className="p-3 border-b bg-muted/50">
              <h3 className="text-sm font-semibold">Plataformas</h3>
            </div>
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                <button
                  onClick={() => setFilterPlatform('all')}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                    filterPlatform === 'all' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                  )}
                >
                  <MessageCircle className="h-4 w-4" />
                  <span className="truncate">Todas</span>
                  <Badge variant="secondary" className="ml-auto text-xs">{totalOpen}</Badge>
                </button>
                {platformCounts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setFilterPlatform(p.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                      filterPlatform === p.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                    )}
                  >
                    <PlatformIcon icon={p.icon} size="sm" />
                    <span className="truncate">{p.name}</span>
                    {p.count > 0 && (
                      <Badge variant="secondary" className="ml-auto text-xs">{p.count}</Badge>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Conversations list */}
          <div className="col-span-3 border rounded-lg overflow-hidden">
            <div className="p-3 border-b bg-muted/50 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Conversas</h3>
                {searchQuery && (
                  <span className="text-[10px] text-muted-foreground">{filteredConversations.length} resultado(s)</span>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar contato, telefone, mensagem..."
                  className="h-8 pl-7 pr-7 text-xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Limpar busca"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <ScrollArea className="h-[calc(100%-92px)]">
              <ConversationList
                conversations={filteredConversations}
                platforms={activePlatforms}
                activeId={activeConversationId}
                onSelect={handleSelectConv}
              />
            </ScrollArea>
          </div>

          {/* Chat area */}
          <div className="col-span-7 border rounded-lg overflow-hidden flex flex-col">
            {activeConv ? (
              <>
                <ChatHeader
                  conversation={activeConv}
                  platform={getPlatform(activeConv.platform_id)}
                  linkedContact={linkedContact}
                  onLinkContact={(cid) => linkConversationToCrmContact(activeConv.id, cid)}
                  onUpdateDigitalChannelContext={(channels) => updateDigitalChannelContext(activeConv.id, channels)}
                  platforms={activePlatforms}
                />
                <ChatMessages
                  messages={messages}
                  loading={messagesLoading}
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-2">
                  <MessageCircle className="h-12 w-12 mx-auto opacity-30" />
                  <p>Selecione uma conversa</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function ConversationList({ conversations, platforms, activeId, onSelect }: {
  conversations: ServiceConversation[];
  platforms: any[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  if (conversations.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        Nenhuma conversa encontrada
      </div>
    );
  }

  return (
    <div className="divide-y">
      {conversations.map(conv => {
        const platform = platforms.find(p => p.id === conv.platform_id);
        const funnel = FUNNEL_STAGES[normalizeCrmStage(conv.funnel_stage)] || FUNNEL_STAGES.novo_lead;
        const initials = (conv.contact_name || 'C').slice(0, 2).toUpperCase();

        return (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={cn(
              'w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50',
              activeId === conv.id && 'bg-primary/5 border-l-2 border-primary'
            )}
          >
            <Avatar className="h-10 w-10 shrink-0">
              {conv.contact_avatar_url && <AvatarImage src={conv.contact_avatar_url} alt={conv.contact_name || ''} />}
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">
                  {conv.contact_name || conv.contact_handle || 'Cliente'}
                </span>
                {conv.unread_count > 0 && (
                  <Badge className="h-5 min-w-5 px-1 text-xs">{conv.unread_count}</Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {platform && <PlatformIcon icon={platform.icon} size="sm" />}
                <span className="text-xs text-muted-foreground truncate">
                  {conv.last_message_preview || 'Nova conversa'}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(conv.last_message_at), 'dd/MM HH:mm', { locale: ptBR })}
              </span>
              <div className={cn('w-2 h-2 rounded-full', funnel.color)} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ChatHeader({ conversation, platform, linkedContact, onLinkContact, onBack, onUpdateDigitalChannelContext, platforms }: {
  conversation: ServiceConversation;
  platform: any;
  linkedContact?: any;
  onLinkContact: (contactId: string | null) => void;
  onBack?: () => void;
  onUpdateDigitalChannelContext: (channels: SalesChannelEntry[]) => void;
  platforms: any[];
}) {
  const [showChannels, setShowChannels] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const salesChannels: SalesChannelEntry[] = (conversation.sales_channels as any) || [];

  const addChannel = (platformId: string) => {
    const updated = [...salesChannels, { platform_id: platformId, added_at: new Date().toISOString() }];
    onUpdateDigitalChannelContext(updated);
  };

  const removeChannel = (index: number) => {
    const updated = salesChannels.filter((_, i) => i !== index);
    onUpdateDigitalChannelContext(updated);
  };

  const getPlatformInfo = (id: string) => platforms.find(p => p.id === id);

  const displayName = linkedContact?.name || conversation.contact_name || conversation.contact_handle || 'Cliente';
  const isVip = linkedContact?.client_classification === 'vip';
  const ltv = Number(linkedContact?.lifetime_value || 0);
  const paidOrders = linkedContact?.paid_orders_count || 0;

  return (
    <div className="border-b bg-muted/30">
      <div className="p-3 flex items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <Avatar className="h-8 w-8 shrink-0">
          {(linkedContact?.photo_url || conversation.contact_avatar_url) && (
            <AvatarImage src={linkedContact?.photo_url || conversation.contact_avatar_url} alt={displayName} />
          )}
          <AvatarFallback className="text-xs">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-medium truncate">{displayName}</p>
            {isVip && (
              <Badge className="h-4 text-[9px] px-1 bg-emerald-500/15 text-emerald-700 border-emerald-500/30 gap-0.5">
                <Crown className="h-2.5 w-2.5" /> VIP
              </Badge>
            )}
            {paidOrders > 0 && (
              <Badge variant="secondary" className="h-4 text-[9px] px-1">
                {paidOrders}× R$ {ltv.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </Badge>
            )}
            {linkedContact ? (
              <Link to={`/contatos/inbox?contact=${linkedContact.id}&attend=1`} className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5">
                <ExternalLink className="h-2.5 w-2.5" /> Abrir no CRM
              </Link>
            ) : (
              <button
                onClick={() => setShowLink(true)}
                className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5"
                title="Vincular a um contato do CRM"
              >
                <Link2 className="h-2.5 w-2.5" /> Vincular
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {platform && <span className="text-xs flex items-center gap-1"><PlatformIcon icon={platform.icon} size="sm" /> {platform.name}</span>}
            {conversation.contact_handle && <span className="text-xs text-muted-foreground">{conversation.contact_handle}</span>}
          </div>
        </div>

        <ResponsiveDialog open={showLink} onOpenChange={setShowLink} title="Vincular contato do CRM">
          <div className="space-y-3">
            <ContactAutocomplete
              onSelect={(c) => {
                if (c) {
                  onLinkContact(c.id);
                  setShowLink(false);
                }
              }}
              placeholder="Buscar contato..."
            />
            {linkedContact && (
              <Button variant="outline" className="w-full" onClick={() => { onLinkContact(null); setShowLink(false); }}>
                Remover vínculo atual
              </Button>
            )}
          </div>
        </ResponsiveDialog>

      </div>

      {/* Sales Channels Journey */}
      <div className="px-3 pb-2">
        <button
          onClick={() => setShowChannels(!showChannels)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className={cn('h-3 w-3 transition-transform', showChannels && 'rotate-90')} />
          <span>Jornada de Canais</span>
          {salesChannels.length > 0 && (
            <div className="flex items-center gap-0.5 ml-1">
              {salesChannels.map((ch, i) => {
                const p = getPlatformInfo(ch.platform_id);
                return (
                  <span key={i}>
                    {i > 0 && <span className="text-muted-foreground mx-0.5">›</span>}
                    <span>{p?.icon || '📱'}</span>
                  </span>
                );
              })}
            </div>
          )}
        </button>

        {showChannels && (
          <div className="mt-2 space-y-2">
            {salesChannels.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {salesChannels.map((ch, i) => {
                  const p = getPlatformInfo(ch.platform_id);
                  return (
                    <div key={i} className="flex items-center">
                      {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground mx-0.5" />}
                      <Badge variant="secondary" className="text-xs gap-1 pr-1">
                        <span>{p?.icon || '📱'}</span>
                        <span>{p?.name || 'Canal'}</span>
                        <button onClick={() => removeChannel(i)} className="ml-0.5 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
            <Select value="__none__" onValueChange={(v) => { if (v !== '__none__') addChannel(v); }}>
              <SelectTrigger className="h-7 w-[180px] text-xs">
                <SelectValue placeholder="+ Adicionar canal..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">+ Adicionar canal...</SelectItem>
                {platforms.map(p => (
                  <SelectItem key={p.id} value={p.id}><span className="flex items-center gap-1"><PlatformIcon icon={p.icon} size="sm" /> {p.name}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatMessages({ messages, loading }: {
  messages: ServiceMessage[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">Nenhuma mensagem ainda</p>
        )}
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            message={msg}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

function MessageBubble({ message }: {
  message: ServiceMessage;
}) {
  const isCustomer = message.sender === 'customer';
  const isAI = message.sender === 'ai_suggestion';
  const isAgent = message.sender === 'agent';

  return (
    <div className={cn('flex gap-2', isCustomer ? 'justify-start' : 'justify-end')}>
      {isCustomer && (
        <Avatar className="h-7 w-7 shrink-0 mt-1">
          <AvatarFallback className="text-[10px]"><User className="h-3.5 w-3.5" /></AvatarFallback>
        </Avatar>
      )}

      <div className={cn(
        'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm',
        isCustomer && 'bg-muted text-foreground rounded-tl-sm',
        isAgent && 'bg-primary text-primary-foreground rounded-tr-sm',
        isAI && 'bg-amber-500/10 border border-amber-500/30 text-foreground rounded-tr-sm',
      )}>
        {isAI && (
          <div className="flex items-center gap-1.5 mb-1.5 text-xs text-amber-600 font-medium">
            <Bot className="h-3.5 w-3.5" />
            Sugestão da IA
          </div>
        )}
        <p className="whitespace-pre-wrap">{message.content}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className={cn(
            'text-[10px]',
            isAgent ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}>
            {format(new Date(message.created_at), 'HH:mm', { locale: ptBR })}
          </span>

          {isAI && message.ai_approved === null && (
            <div className="flex items-center gap-1 ml-auto">
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                navigator.clipboard.writeText(message.content);
                toast.success('Copiado!');
              }}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          )}
          {isAI && message.ai_approved === true && (
            <Badge variant="secondary" className="text-[10px] h-4 ml-auto">✓ Aprovada</Badge>
          )}
          {isAI && message.ai_approved === false && (
            <Badge variant="outline" className="text-[10px] h-4 ml-auto text-destructive">✗ Rejeitada</Badge>
          )}
        </div>
      </div>

      {(isAgent || isAI) && (
        <Avatar className="h-7 w-7 shrink-0 mt-1">
          <AvatarFallback className="text-[10px]">
            {isAI ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
