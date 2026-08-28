import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns a map of contact_id -> earliest pending task scheduled/due date (ISO string).
 * Used by CRM cards to show "Sem tarefas" / "Hoje" / "Xd atrasada" indicators based on
 * the real `tasks` table (not just contact.next_action_date).
 */
export function useContactNextTasks() {
  const [map, setMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tasks')
      .select('contact_id, scheduled_date, due_date, scheduled_time, status')
      .not('contact_id', 'is', null)
      .eq('source', 'crm_next_action')
      .neq('status', 'concluído')
      .is('deleted_at', null);

    const m: Record<string, string> = {};
    (data || []).forEach((t: any) => {
      const date = t.scheduled_date || t.due_date;
      if (!date || !t.contact_id) return;
      const iso = t.scheduled_time ? `${date}T${t.scheduled_time}` : `${date}T00:00:00`;
      if (!m[t.contact_id] || iso < m[t.contact_id]) {
        m[t.contact_id] = iso;
      }
    });
    setMap(m);
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

  return { nextTaskByContact: map, loading, refetch: fetch };
}
