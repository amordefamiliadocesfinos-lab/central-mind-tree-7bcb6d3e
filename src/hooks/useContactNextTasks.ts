import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Retorna as obrigações CRM oficiais pendentes por contato. A base comercial
 * pode usar esses mapas para segmentar sem inferir nada por nome ou prioridade.
 */
export function useContactNextTasks() {
  const [map, setMap] = useState<Record<string, string>>({});
  const [reactivationMap, setReactivationMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tasks')
      .select('contact_id, scheduled_date, due_date, scheduled_time, status, source')
      .not('contact_id', 'is', null)
      .in('source', ['crm_next_action', 'crm_reactivation'])
      .neq('status', 'concluído')
      .is('deleted_at', null);

    const m: Record<string, string> = {};
    const reactivations: Record<string, string> = {};
    (data || []).forEach((t: any) => {
      const date = t.scheduled_date || t.due_date;
      if (!date || !t.contact_id) return;
      const iso = t.scheduled_time ? `${date}T${t.scheduled_time}` : `${date}T00:00:00`;
      const target = t.source === 'crm_reactivation' ? reactivations : m;
      if (!target[t.contact_id] || iso < target[t.contact_id]) {
        target[t.contact_id] = iso;
      }
    });
    setMap(m);
    setReactivationMap(reactivations);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
    const channel = supabase
      .channel('contact-next-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetch]);

  return { nextTaskByContact: map, reactivationByContact: reactivationMap, loading, refetch: fetch };
}
