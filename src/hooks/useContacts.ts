import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { normalizeCrmStage } from '@/lib/crm/model';

export interface Contact {
  id: string;
  name: string;
  fantasy_name?: string;
  code?: string;
  type: string; // 'cliente' | 'fornecedor' | 'ambos'
  person_type?: string; // 'fisica' | 'juridica'
  document?: string; // CPF or CNPJ
  customer_since?: string;
  taxpayer_type?: string;
  state_registration?: string;
  rg?: string;
  issuing_agency?: string;
  
  // Address
  zip_code?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  address?: string;
  address_number?: string;
  address_complement?: string;
  
  // Billing address
  billing_zip_code?: string;
  billing_state?: string;
  billing_city?: string;
  billing_neighborhood?: string;
  billing_address?: string;
  billing_number?: string;
  billing_complement?: string;
  
  // Contact
  contact_info?: string;
  contact_people?: any;
  phone?: string;
  landline?: string;
  fax?: string;
  mobile?: string;
  mobile_carrier?: string;
  email?: string;
  nfe_email?: string;
  website?: string;
  skype?: string;
  whatsapp?: string;
  next_visit?: string;
  
  // Additional data
  avg_load_percentage?: number;
  marital_status?: string;
  profession?: string;
  gender?: string;
  birth_date?: string;
  birthplace?: string;
  photo_url?: string;
  father_name?: string;
  father_cpf?: string;
  mother_name?: string;
  mother_cpf?: string;
  contact_type?: string;
  salesperson?: string;
  default_operation_nature?: string;
  
  // Financial
  credit_limit_type?: string; // 'unlimited' | 'zero' | 'custom'
  credit_limit_value?: number;
  payment_condition?: string;
  category?: string;
  
  // Sales channels journey
  sales_channels?: Array<{ platform_id: string; added_at: string }>;
  
  // Funnel
  // A contact can be a canonical customer/supplier without participating in CRM.
  funnel_status?: string | null;
  temperatura_lead?: string; // 'frio' | 'morno' | 'quente'
  valor_estimado?: number;
  ultimo_contato?: string;
  origem_lead?: string;
  commercial_opt_out?: boolean;
  
  // Next action
  next_action_text?: string;
  next_action_date?: string;
  next_contact_date?: string;

  // Classification
  client_classification?: string; // 'vip' | 'alto_potencial' | 'medio' | 'baixo_potencial'
  
  // Campaign
  campaign_idea_id?: string;

  // Customer health (auto-synced from orders + payments)
  lifetime_value?: number;
  paid_orders_count?: number;
  last_purchase_date?: string;
  last_payment_date?: string;

  // Lost lead
  lost_reason?: string;
  lost_reason_detail?: string;
  lost_at?: string;

  // Other
  company_name?: string;
  notes?: string;
  is_active: boolean;
  converted_at?: string;
  created_at: string;
  updated_at: string;
}

// Columns actually rendered in the list/kanban/cards. Drops heavy fiscal,
// address-detail and parents columns that are only needed in the edit drawer.
const LIST_COLUMNS = 'id,name,fantasy_name,code,type,person_type,document,phone,landline,mobile,email,whatsapp,website,photo_url,city,state,contact_type,salesperson,category,funnel_status,temperatura_lead,valor_estimado,ultimo_contato,origem_lead,commercial_opt_out,next_action_text,next_action_date,next_contact_date,client_classification,campaign_idea_id,lifetime_value,paid_orders_count,last_purchase_date,last_payment_date,lost_reason,lost_at,company_name,notes,is_active,converted_at,created_at,updated_at';

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const PAGE = 500;
      let from = 0;
      const all: any[] = [];
      while (true) {
        const { data, error } = await supabase
          .from('contacts')
          .select(LIST_COLUMNS)
          .order('name')
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      const normalized = all.map(contact => ({
        ...contact,
        // Do not turn a purely cadastral contact into a lead while reading it.
        funnel_status: contact.funnel_status ? normalizeCrmStage(contact.funnel_status) : null,
      })) as unknown as Contact[];
      // Troca a base de uma vez para impedir indicadores parciais durante a paginação.
      setContacts(normalized);
    } catch (error: any) {
      console.error('Error fetching contacts:', error);
      toast.error('Erro ao carregar contatos');
    } finally {
      setLoading(false);
    }
  };

  // Fetch the full record (all 80+ columns) for the edit drawer only.
  const fetchContactFull = async (id: string): Promise<Contact | null> => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Contact) || null;
    } catch (error: any) {
      console.error('Error fetching contact full:', error);
      return null;
    }
  };

  const createContact = async (contact: Partial<Contact>): Promise<Contact> => {
    try {
      const cleanValue = (val: any) => (val === '' || val === undefined ? null : val);
      const cleanNumber = (val: any) => {
        if (val === '' || val === undefined || val === null) return null;
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return isNaN(num) ? null : num;
      };

      const payload: any = {
        name: contact.name,
        fantasy_name: cleanValue(contact.fantasy_name),
        code: cleanValue(contact.code),
        type: contact.type || 'cliente',
        person_type: contact.person_type || 'fisica',
        document: cleanValue(contact.document),
        customer_since: cleanValue(contact.customer_since),
        taxpayer_type: cleanValue(contact.taxpayer_type),
        state_registration: cleanValue(contact.state_registration),
        rg: cleanValue(contact.rg),
        issuing_agency: cleanValue(contact.issuing_agency),
        zip_code: cleanValue(contact.zip_code),
        state: cleanValue(contact.state),
        city: cleanValue(contact.city),
        neighborhood: cleanValue(contact.neighborhood),
        address: cleanValue(contact.address),
        address_number: cleanValue(contact.address_number),
        address_complement: cleanValue(contact.address_complement),
        billing_zip_code: cleanValue(contact.billing_zip_code),
        billing_state: cleanValue(contact.billing_state),
        billing_city: cleanValue(contact.billing_city),
        billing_neighborhood: cleanValue(contact.billing_neighborhood),
        billing_address: cleanValue(contact.billing_address),
        billing_number: cleanValue(contact.billing_number),
        billing_complement: cleanValue(contact.billing_complement),
        contact_info: cleanValue(contact.contact_info),
        contact_people: contact.contact_people,
        phone: cleanValue(contact.phone),
        landline: cleanValue(contact.landline),
        fax: cleanValue(contact.fax),
        mobile: cleanValue(contact.mobile),
        mobile_carrier: cleanValue(contact.mobile_carrier),
        email: cleanValue(contact.email),
        nfe_email: cleanValue(contact.nfe_email),
        website: cleanValue(contact.website),
        skype: cleanValue(contact.skype),
        whatsapp: cleanValue(contact.whatsapp),
        next_visit: cleanValue(contact.next_visit),
        avg_load_percentage: cleanNumber(contact.avg_load_percentage),
        marital_status: cleanValue(contact.marital_status),
        profession: cleanValue(contact.profession),
        gender: cleanValue(contact.gender),
        birth_date: cleanValue(contact.birth_date),
        birthplace: cleanValue(contact.birthplace),
        photo_url: cleanValue(contact.photo_url),
        father_name: cleanValue(contact.father_name),
        father_cpf: cleanValue(contact.father_cpf),
        mother_name: cleanValue(contact.mother_name),
        mother_cpf: cleanValue(contact.mother_cpf),
        contact_type: cleanValue(contact.contact_type),
        salesperson: cleanValue(contact.salesperson),
        default_operation_nature: cleanValue(contact.default_operation_nature),
        credit_limit_type: contact.credit_limit_type || 'unlimited',
        credit_limit_value: cleanNumber(contact.credit_limit_value),
        payment_condition: cleanValue(contact.payment_condition),
        category: cleanValue(contact.category),
        company_name: cleanValue(contact.company_name),
        notes: cleanValue(contact.notes),
        next_action_text: cleanValue(contact.next_action_text),
        next_action_date: cleanValue(contact.next_action_date),
        // Only CRM flows explicitly pass a stage. Financial/operational
        // registrations remain outside the funnel.
        funnel_status: contact.funnel_status ? normalizeCrmStage(contact.funnel_status) : null,
        next_contact_date: cleanValue(contact.next_contact_date),
        temperatura_lead: contact.temperatura_lead || 'morno',
        valor_estimado: cleanNumber(contact.valor_estimado),
        ultimo_contato: cleanValue(contact.ultimo_contato),
        origem_lead: cleanValue(contact.origem_lead) || 'Não Informado',
        is_active: contact.is_active ?? true,
        campaign_idea_id: cleanValue(contact.campaign_idea_id),
        client_classification: cleanValue(contact.client_classification),
      };

      const { data, error } = await supabase
        .from('contacts')
        .insert(payload)
        .select(LIST_COLUMNS)
        .single();

      if (error) throw error;

      // Local insert + keep list sorted by name (matches initial fetch order)
      const created = data as unknown as Contact;
      setContacts(prev => {
        const next = [...prev, created];
        next.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return next;
      });
      toast.success('Contato criado com sucesso');
      return created;
    } catch (error: any) {
      console.error('Error creating contact:', error);
      toast.error('Erro ao criar contato');
      throw error;
    }
  };

  const updateContact = async (id: string, contact: Partial<Contact>) => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .update({
          ...contact,
          ...(contact.funnel_status ? { funnel_status: normalizeCrmStage(contact.funnel_status) } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select(LIST_COLUMNS)
        .single();

      if (error) throw error;

      // Local merge — avoids refetching all 2000 rows
      setContacts(prev => prev.map(c => (c.id === id ? { ...c, ...(data as any) } : c)));
      toast.success('Contato atualizado com sucesso');
    } catch (error: any) {
      console.error('Error updating contact:', error);
      toast.error('Erro ao atualizar contato');
      throw error;
    }
  };

  const markContactTouchedLocal = (id: string, date: string) => {
    setContacts(prev => prev.map(c => (
      c.id === id
        ? { ...c, ultimo_contato: date, updated_at: new Date().toISOString() }
        : c
    )));
  };

  const deleteContact = async (id: string) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      // Local soft-delete
      setContacts(prev => prev.map(c => (c.id === id ? { ...c, is_active: false } : c)));
      toast.success('Contato removido com sucesso');
    } catch (error: any) {
      console.error('Error deleting contact:', error);
      toast.error('Erro ao remover contato');
      throw error;
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  return {
    contacts,
    loading,
    fetchContacts,
    fetchContactFull,
    createContact,
    updateContact,
    markContactTouchedLocal,
    deleteContact,
  };
}
