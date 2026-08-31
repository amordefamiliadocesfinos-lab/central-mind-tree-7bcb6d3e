CREATE TABLE public.crm_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  message_text TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'prepared', 'sending', 'completed', 'cancelled')),
  segment_filters JSONB,
  total_selected INTEGER NOT NULL DEFAULT 0,
  total_eligible INTEGER NOT NULL DEFAULT 0,
  total_excluded INTEGER NOT NULL DEFAULT 0,
  total_sent INTEGER NOT NULL DEFAULT 0,
  total_failed INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.app_users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_campaigns TO authenticated;
GRANT ALL ON public.crm_campaigns TO service_role;

ALTER TABLE public.crm_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage crm campaigns"
ON public.crm_campaigns
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_crm_campaigns_updated_at
BEFORE UPDATE ON public.crm_campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.crm_campaign_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id),
  conversation_id UUID,
  phone_normalized TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'excluded', 'skipped')),
  exclusion_reason TEXT,
  delivery_mode TEXT,
  rendered_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_code TEXT,
  error_message TEXT,
  service_message_id UUID,
  external_message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, contact_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_campaign_recipients TO authenticated;
GRANT ALL ON public.crm_campaign_recipients TO service_role;

ALTER TABLE public.crm_campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage crm campaign recipients"
ON public.crm_campaign_recipients
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE INDEX idx_crm_campaign_recipients_campaign ON public.crm_campaign_recipients(campaign_id);
CREATE INDEX idx_crm_campaign_recipients_contact ON public.crm_campaign_recipients(contact_id);