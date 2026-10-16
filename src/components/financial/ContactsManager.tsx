import { useState } from 'react';
import { WhatsAppMessageSelector } from '@/components/crm/WhatsAppMessageSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Filter, 
  RefreshCw,
  Printer,
  FileSpreadsheet,
  MessageCircle,
  ShoppingCart,
  Users,
  Inbox,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useContacts, Contact } from '@/hooks/useContacts';

import { ContactFormDialog } from './ContactFormDialog';
import { updateContactOfficialNextAction } from '@/lib/crm/contactProfileWriter';
import { isCrmNextActionChanged } from '@/lib/crm/contactEditContract';
import { ContactOrderHistory } from './ContactOrderHistory';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { openWhatsApp } from '@/lib/whatsapp';
import { useEffect } from 'react';
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

export function ContactsManager() {
  const { contacts, loading, fetchContacts, createContact, updateContact, deleteContact } = useContacts();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyContact, setHistoryContact] = useState<Contact | null>(null);
  const [ideaNames, setIdeaNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const ideaIds = contacts.filter(c => c.campaign_idea_id).map(c => c.campaign_idea_id!);
    if (ideaIds.length === 0) return;
    const uniqueIds = [...new Set(ideaIds)];
    supabase.from('digital_ideas').select('id, title').in('id', uniqueIds).then(({ data }) => {
      const map: Record<string, string> = {};
      (data || []).forEach((d: any) => { map[d.id] = d.title; });
      setIdeaNames(map);
    });
  }, [contacts]);

  const filteredContacts = contacts.filter((contact) => {
    // Filter by active status
    if (showOnlyActive && !contact.is_active) return false;
    
    // Filter by type
    if (typeFilter !== 'all') {
      if (typeFilter === 'cliente' && contact.type !== 'cliente' && contact.type !== 'ambos') return false;
      if (typeFilter === 'fornecedor' && contact.type !== 'fornecedor' && contact.type !== 'ambos') return false;
    }
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        contact.name?.toLowerCase().includes(query) ||
        contact.fantasy_name?.toLowerCase().includes(query) ||
        contact.document?.toLowerCase().includes(query) ||
        contact.email?.toLowerCase().includes(query) ||
        contact.code?.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  const handleCreateClick = () => {
    setEditingContact(undefined);
    setFormOpen(true);
  };

  const handleEditClick = (contact: Contact) => {
    setEditingContact(contact);
    setFormOpen(true);
  };

  const handleDeleteClick = (contact: Contact) => {
    setContactToDelete(contact);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (contactToDelete) {
      await deleteContact(contactToDelete.id);
      setDeleteDialogOpen(false);
      setContactToDelete(null);
    }
  };

  const handleSave = async (data: Partial<Contact>) => {
    if (editingContact) {
      const { next_action_text, next_action_date, next_contact_date, ...general } = data;
      const desired = {
        title: next_action_text?.trim() || null,
        dueAt: next_action_date || next_contact_date || null,
      };
      if (isCrmNextActionChanged(editingContact, desired)) {
        await updateContactOfficialNextAction({
          contactId: editingContact.id, baseline: editingContact,
          title: desired.title, dueAt: desired.dueAt,
        });
      }
      await updateContact(editingContact.id, general);
    } else {
      await createContact(data);
    }
    setFormOpen(false);
    setEditingContact(undefined);
  };

  const [whatsAppContact, setWhatsAppContact] = useState<Contact | undefined>(undefined);

  const handleWhatsAppClick = (contact: Contact) => {
    const phone = contact.whatsapp || contact.mobile || contact.phone;
    if (phone) {
      setWhatsAppContact(contact);
    }
  };

  const handleWhatsAppSend = async (message: string, templateLabel: string, attachments?: any[]) => {
    if (!whatsAppContact) return;
    const phone = whatsAppContact.whatsapp || whatsAppContact.mobile || whatsAppContact.phone;
    if (phone) {
      try {
        await supabase.from('contact_history').insert({
          contact_id: whatsAppContact.id,
          event_type: 'whatsapp',
          interaction_type: 'whatsapp',
          description: `💬 Mensagem iniciada via WhatsApp (${templateLabel})`,
          interaction_date: new Date().toISOString(),
        });
      } catch (e) {
        console.error('Erro ao registrar histórico:', e);
      }
      if (attachments?.length) {
        const { shareToWhatsApp } = await import('@/lib/whatsappShare');
        await shareToWhatsApp({ phone, message, attachments });
      } else {
        openWhatsApp(phone, message);
      }
    }
    setWhatsAppContact(undefined);
  };

  const handleHistoryClick = (contact: Contact) => {
    setHistoryContact(contact);
    setHistoryOpen(true);
  };

  const formatDocument = (doc?: string) => {
    if (!doc) return '';
    const cleaned = doc.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (cleaned.length === 14) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return doc;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Clientes e Fornecedores</h2>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="cliente">Clientes</SelectItem>
              <SelectItem value="fornecedor">Fornecedores</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Button onClick={handleCreateClick} className="bg-green-600 hover:bg-green-700">
          <Plus className="h-4 w-4 mr-2" />
          Incluir cadastro
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-[200px] max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome, fantasia, e-mail, CPF ou CNPJ"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('all');
              }}
            >
              Limpar
            </Button>
            
            <Button variant="outline" size="icon" onClick={fetchContacts}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            
            <Button variant="outline" size="icon">
              <Printer className="h-4 w-4" />
            </Button>
            
            <Button variant="outline" size="icon">
              <FileSpreadsheet className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {searchQuery && (
          <div className="mt-2 text-sm text-muted-foreground">
            Exibindo pela ordem de inclusão × 
            <button 
              className="text-primary ml-1 hover:underline"
              onClick={() => setSearchQuery('')}
            >
              Limpar
            </button>
          </div>
        )}
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum contato encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredContacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-mono text-sm">
                      {contact.code || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-primary hover:underline cursor-pointer" onClick={() => handleEditClick(contact)}>
                          {contact.name}
                        </span>
                        {contact.fantasy_name && (
                          <span className="text-xs text-muted-foreground">
                            {contact.fantasy_name}
                          </span>
                        )}
                        {contact.campaign_idea_id && ideaNames[contact.campaign_idea_id] && (
                          <Badge variant="outline" className="w-fit text-[10px] border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30">
                            📣 Campanha: {ideaNames[contact.campaign_idea_id]}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDocument(contact.document)}</TableCell>
                    <TableCell>{contact.city || '-'}</TableCell>
                    <TableCell>{contact.phone || contact.mobile || '-'}</TableCell>
                    <TableCell>
                      {(contact.whatsapp || contact.mobile || contact.phone) && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => handleWhatsAppClick(contact)}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/contatos?contact=${contact.id}`)}>
                            <Users className="h-4 w-4 mr-2" />
                            Abrir no CRM
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/contatos/inbox?contact=${contact.id}`)}>
                            <Inbox className="h-4 w-4 mr-2" />
                            Abrir na Caixa de Entrada
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleHistoryClick(contact)}>
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Histórico de Pedidos
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => handleEditClick(contact)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteClick(contact)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Form Dialog */}
      <ContactFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editingContact}
        onSave={handleSave}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o contato "{contactToDelete?.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Order History Dialog */}
      <ContactOrderHistory
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        contact={historyContact}
      />
      <WhatsAppMessageSelector
        open={!!whatsAppContact}
        onOpenChange={(open) => { if (!open) setWhatsAppContact(undefined); }}
        contactName={whatsAppContact?.name || ''}
        funnelStatus={whatsAppContact?.funnel_status || ''}
        contactId={whatsAppContact?.id}
        onSend={handleWhatsAppSend}
      />
    </div>
  );
}
