/** CRM–UX 02 B-06: reuse the existing contact-from-media flow within the third column. */
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AvatarCropEditor } from '@/components/financial/AvatarCropEditor';
import { saveContactProfile } from '@/lib/crm/contactProfileWriter';
import { PROFILE_EDITABLE_KEYS } from '@/lib/crm/contactEditContract';
import type { Contact } from '@/hooks/useContacts';
import { toast } from 'sonner';

const allowed = new Set<string>(PROFILE_EDITABLE_KEYS as readonly string[]);
type Crop = { blob: Blob; bbox: { x: number; y: number; width: number; height: number } | null };

async function videoFrame(file: File): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    const finish = () => URL.revokeObjectURL(url);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onloadeddata = () => {
      video.currentTime = Math.min(1, (Number.isFinite(video.duration) ? video.duration : 1) * 0.1);
    };
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 720;
      canvas.height = video.videoHeight || 1280;
      const ctx = canvas.getContext('2d');
      if (!ctx) { finish(); reject(new Error('Não foi possível preparar o vídeo.')); return; }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        finish();
        if (blob) resolve(blob);
        else reject(new Error('Não foi possível extrair o frame do vídeo.'));
      }, 'image/jpeg', 0.92);
    };
    video.onerror = () => { finish(); reject(new Error('Vídeo incompatível.')); };
    video.src = url;
  });
}

export function ContactProfileMediaImport({
  contact, onSaved, onPhotoChange, onBusyChange,
}: {
  contact: Contact;
  onSaved: (contact: Contact) => void;
  onPhotoChange?: (photo: string | null) => Promise<void> | void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [proposal, setProposal] = useState<Partial<Contact> | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const busy = analyzing || applying || Boolean(proposal) || Boolean(crop);

  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  useEffect(() => {
    setProposal(null);
    setCrop(null);
  }, [contact.id]);

  const analyze = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Escolha uma mídia de até 20 MB.');
      return;
    }
    setAnalyzing(true);
    try {
      const isVideo = file.type.startsWith('video/');
      const uploaded = isVideo ? await videoFrame(file) : file;
      const mime = isVideo ? 'image/jpeg' : file.type;
      const ext = isVideo ? 'jpg' : file.name.split('.').pop() || 'png';
      if (!mime.startsWith('image/')) throw new Error('Use imagem ou vídeo compatível.');
      const path = 'ai-extract/' + crypto.randomUUID() + '.' + ext;
      const { error: uploadError } = await supabase.storage.from('media').upload(path, uploaded, {
        contentType: mime, upsert: true,
      });
      if (uploadError) throw uploadError;
      const url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
      const { data, error } = await supabase.functions.invoke('contact-from-media', {
        body: { mediaUrl: url, mimeType: mime },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      const extracted = (data?.contact || {}) as Record<string, unknown>;
      const proposed: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(extracted)) {
        if (!allowed.has(key) || value === null || value === undefined || value === '') continue;
        const current = (contact as unknown as Record<string, unknown>)[key];
        if (key === 'name' || current === null || current === undefined || current === '') {
          proposed[key] = value;
        }
      }
      const bbox = extracted.profile_photo_bbox;
      const hasPhoto = Boolean(extracted.has_profile_photo);
      if (hasPhoto && bbox && typeof bbox === 'object' && 'x' in bbox && typeof bbox.x === 'number') {
        setCrop({ blob: uploaded, bbox: bbox as Crop['bbox'] });
      }
      setProposal(proposed as Partial<Contact>);
      toast.success('Extração concluída. Confira os dados antes de aplicar.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha na análise da mídia.');
    } finally {
      setAnalyzing(false);
    }
  };

  const applyProposal = async () => {
    if (!proposal || applying) return;
    setApplying(true);
    try {
      const result = await saveContactProfile({
        contactId: contact.id, baseline: contact, draft: proposal,
      });
      onSaved(result.contact);
      setProposal(null);
      toast.success('Dados confirmados e salvos na ficha.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível gravar os dados extraídos.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md border p-2">
      <p className="text-xs font-medium">Extrair dados de imagem ou vídeo com IA</p>
      <p className="text-[10px] text-muted-foreground">
        A IA sugere preenchimentos; nada é aplicado ao cadastro sem confirmar.
      </p>
      <Input ref={ref} type="file" accept="image/*,video/*" className="text-xs"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = '';
          if (file) void analyze(file);
        }} />
      {analyzing && <p role="status" className="text-xs">Analisando mídia...</p>}
      {proposal && (
        <div className="space-y-2">
          <p className="text-xs font-semibold">Dados sugeridos</p>
          {Object.entries(proposal).length === 0
            ? <p className="text-xs text-muted-foreground">Nenhum campo novo sugerido.</p>
            : Object.entries(proposal).map(([key, value]) => (
                <div key={key} className="text-[11px]"><strong>{key}:</strong> {String(value)}</div>
              ))}
          <div className="flex flex-wrap gap-1">
            <Button type="button" size="sm" onClick={() => void applyProposal()} disabled={applying || Boolean(crop)}>
              {applying ? 'Salvando...' : 'Aplicar dados'}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={applying}
              onClick={() => { setProposal(null); setCrop(null); }}>Descartar</Button>
          </div>
        </div>
      )}
      {crop && (
        <AvatarCropEditor sourceBlob={crop.blob} initialBbox={crop.bbox}
          onConfirm={(url) => {
            void Promise.resolve(onPhotoChange?.(url)).then(() => setCrop(null));
          }}
          onCancel={() => setCrop(null)} />
      )}
    </div>
  );
}
