import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CalendarIcon, Loader2, Search, MessageCircle, Plus, X, ChevronRight, ChevronDown, ShoppingCart, Sparkles } from 'lucide-react';
import { useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { usePlatforms } from '@/hooks/usePlatforms';
import { PlatformHierarchicalPicker } from '@/components/digital/PlatformHierarchicalPicker';
import { ContactAvatar } from '@/components/crm/ContactAvatar';
import { ContactTimeline } from '@/components/crm/ContactTimeline';
import { WhatsAppMessageSelector } from '@/components/crm/WhatsAppMessageSelector';
import { ContactOrdersList } from '@/components/crm/ContactOrdersList';
import { AvatarCropEditor } from './AvatarCropEditor';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Contact } from '@/hooks/useContacts';
import { useContactHistory } from '@/hooks/useContactHistory';
import { useContactsWithOrders } from '@/hooks/useContactsWithOrders';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { openWhatsApp } from '@/lib/whatsapp';
import { registerCrmRouteGuard } from '@/lib/crm/crmRouteNavigationGuards';
import { getCrmFormExitReason } from '@/lib/crm/crmFormExitProtection';

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact;
  onSave: (data: Partial<Contact>) => Promise<void>;
}

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const TAXPAYER_TYPES = [
  { value: '1', label: '1 - Contribuinte ICMS' },
  { value: '2', label: '2 - Contribuinte isento' },
  { value: '9', label: '9 - Não contribuinte' },
];

const MOBILE_CARRIERS = ['Vivo', 'Claro', 'Tim', 'Oi', 'Outros'];

const MARITAL_STATUS = [
  'Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'Separado(a)', 'União Estável'
];

const GENDERS = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'feminino', label: 'Feminino' },
  { value: 'outro', label: 'Outro' },
];

const CONTACT_SUBTYPES = [
  { value: 'revendedor', label: 'Revendedor' },
  { value: 'cliente_final', label: 'Cliente Final' },
  { value: 'atacado', label: 'Atacado' },
];

export function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  onSave,
}: ContactFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [addressTab, setAddressTab] = useState('geral');
  const [showDetails, setShowDetails] = useState(false);
  const [ideas, setIdeas] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    if (open) {
      supabase.from('digital_ideas').select('id, title').order('title').then(({ data }) => {
        setIdeas((data || []) as Array<{ id: string; title: string }>);
      });
    }
  }, [open]);
  const { addEntry } = useContactHistory();
  const navigate = useNavigate();
  const location = useLocation();
  const { activePlatforms } = usePlatforms();
  const { hasOrders } = useContactsWithOrders();
  
  const [form, setForm] = useState<Partial<Contact>>({
    name: '',
    fantasy_name: '',
    code: '',
    type: 'cliente',
    person_type: 'fisica',
    document: '',
    customer_since: new Date().toISOString().split('T')[0],
    taxpayer_type: '9',
    state_registration: '',
    rg: '',
    issuing_agency: '',
    zip_code: '',
    state: '',
    city: '',
    neighborhood: '',
    address: '',
    address_number: '',
    address_complement: '',
    billing_zip_code: '',
    billing_state: '',
    billing_city: '',
    billing_neighborhood: '',
    billing_address: '',
    billing_number: '',
    billing_complement: '',
    contact_info: '',
    phone: '',
    landline: '',
    fax: '',
    mobile: '',
    mobile_carrier: '',
    email: '',
    nfe_email: '',
    website: '',
    skype: '',
    whatsapp: '',
    next_visit: '',
    avg_load_percentage: undefined,
    marital_status: '',
    profession: '',
    gender: '',
    birth_date: '',
    birthplace: '',
    father_name: '',
    father_cpf: '',
    mother_name: '',
    mother_cpf: '',
    contact_type: '',
    salesperson: '',
    default_operation_nature: '',
    credit_limit_type: 'unlimited',
    credit_limit_value: undefined,
    payment_condition: '',
    category: '',
    notes: '',
    next_action_text: '',
    next_action_date: '',
    is_active: true,
  });

  const [baselineForm, setBaselineForm] = useState<Partial<Contact> | null>(null);
  const formDirty = useMemo(() => baselineForm !== null && JSON.stringify(form) !== JSON.stringify(baselineForm), [form, baselineForm]);
  const exitReason = getCrmFormExitReason('contact', formDirty, loading);

  // Registro limitado à Gestão CRM; o diálogo também é reutilizado noutros módulos.
  useEffect(() => {
    if (!open || location.pathname !== '/contatos') return;
    return registerCrmRouteGuard(() => getCrmFormExitReason('contact', formDirty, loading));
  }, [open, location.pathname, formDirty, loading]);

  const requestDismiss = () => {
    if (location.pathname === '/contatos' && exitReason) { toast.warning(exitReason); return; }
    onOpenChange(false);
  };

  useEffect(() => {
    if (contact) {
      const nextForm = { ...contact };
      setForm(nextForm);
      setBaselineForm(nextForm);
      // Auto-expand details if contact has detail fields filled
      const hasDetails = contact.document || contact.rg || contact.email || contact.person_type === 'juridica';
      setShowDetails(!!hasDetails);
    } else {
      const nextForm: Partial<Contact> = {
        name: '', fantasy_name: '', code: '', type: 'cliente', person_type: 'fisica',
        document: '', customer_since: new Date().toISOString().split('T')[0], taxpayer_type: '9',
        state_registration: '', rg: '', issuing_agency: '', zip_code: '', state: '',
        city: '', neighborhood: '', address: '', address_number: '', address_complement: '',
        billing_zip_code: '', billing_state: '', billing_city: '', billing_neighborhood: '',
        billing_address: '', billing_number: '', billing_complement: '', contact_info: '',
        phone: '', landline: '', fax: '', mobile: '', mobile_carrier: '', email: '',
        nfe_email: '', website: '', skype: '', whatsapp: '', next_visit: '',
        avg_load_percentage: undefined, marital_status: '', profession: '', gender: '',
        birth_date: '', birthplace: '', father_name: '', father_cpf: '', mother_name: '',
        mother_cpf: '', contact_type: '', salesperson: '', default_operation_nature: '',
        credit_limit_type: 'unlimited', credit_limit_value: undefined, payment_condition: '',
        category: '', notes: '', next_action_text: '', next_action_date: '', is_active: true,
      };
      setForm(nextForm);
      setBaselineForm(nextForm);
      setShowDetails(false);
    }
  }, [contact, open]);

  const handleSubmit = async () => {
    if (!form.name?.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    setLoading(true);
    try {
      await onSave(form);
      onOpenChange(false);
    } catch (error) {
      // handled in hook
    } finally {
      setLoading(false);
    }
  };

  const handleCepSearch = async (cep: string, isBilling = false) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (data.erro) { toast.error('CEP não encontrado'); return; }
      if (isBilling) {
        setForm(prev => ({ ...prev, billing_zip_code: cleanCep, billing_state: data.uf, billing_city: data.localidade, billing_neighborhood: data.bairro, billing_address: data.logradouro }));
      } else {
        setForm(prev => ({ ...prev, zip_code: cleanCep, state: data.uf, city: data.localidade, neighborhood: data.bairro, address: data.logradouro }));
      }
    } catch { toast.error('Erro ao buscar CEP'); }
  };

  const updateField = (field: keyof Contact, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const [whatsAppOpen, setWhatsAppOpen] = useState(false);

  const handleWhatsAppClick = () => {
    const phone = form.whatsapp || form.mobile || form.phone;
    if (phone) {
      setWhatsAppOpen(true);
    }
  };

  const handleWhatsAppSend = async (message: string, templateLabel: string, attachments?: any[]) => {
    const phone = form.whatsapp || form.mobile || form.phone;
    if (phone) {
      const opened = attachments?.length
        ? await import('@/lib/whatsappShare').then(({ shareToWhatsApp }) => shareToWhatsApp({ phone, message, attachments }))
        : openWhatsApp(phone, message);

      if (!opened) {
        if (!attachments?.length) toast.error('WhatsApp bloqueado pelo navegador. Libere pop-ups e tente novamente.');
        return;
      }

      if (contact?.id) {
        await addEntry(contact.id, 'whatsapp', `💬 Mensagem iniciada via WhatsApp (${templateLabel})`, new Date().toISOString());
      }
    }
  };

  const aiFileRef = useRef<HTMLInputElement>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [cropEditor, setCropEditor] = useState<{ blob: Blob; bbox: { x: number; y: number; width: number; height: number } | null } | null>(null);

  // Recorta os pixels REAIS da mídia original com base no bbox retornado pela IA.
  // Faz pós-processamento não-generativo para remover bordas/padding do print,
  // preencher melhor o avatar e exportar em PNG nítido.
  const cropImageByBbox = async (
    source: Blob,
    bbox: { x: number; y: number; width: number; height: number }
  ): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(source);
      img.onload = () => {
        try {
          const W = img.naturalWidth;
          const H = img.naturalHeight;
          const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
          const x1 = clamp01(bbox.x);
          const y1 = clamp01(bbox.y);
          const x2 = clamp01(bbox.x + bbox.width);
          const y2 = clamp01(bbox.y + bbox.height);
          if (x2 <= x1 || y2 <= y1) {
            URL.revokeObjectURL(objectUrl);
            return resolve(null);
          }
          const bboxPadX = Math.min(0.02, bbox.width * 0.15);
          const bboxPadY = Math.min(0.02, bbox.height * 0.15);
          const paddedX1 = clamp01(x1 - bboxPadX);
          const paddedY1 = clamp01(y1 - bboxPadY);
          const paddedX2 = clamp01(x2 + bboxPadX);
          const paddedY2 = clamp01(y2 + bboxPadY);

          const sx = Math.round(paddedX1 * W);
          const sy = Math.round(paddedY1 * H);
          const sw = Math.max(1, Math.round((paddedX2 - paddedX1) * W));
          const sh = Math.max(1, Math.round((paddedY2 - paddedY1) * H));

          const rawCanvas = document.createElement('canvas');
          rawCanvas.width = sw;
          rawCanvas.height = sh;
          const rawCtx = rawCanvas.getContext('2d', { willReadFrequently: true });
          if (!rawCtx) {
            URL.revokeObjectURL(objectUrl);
            return resolve(null);
          }

          rawCtx.imageSmoothingEnabled = true;
          rawCtx.imageSmoothingQuality = 'high';
          rawCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

          const imageData = rawCtx.getImageData(0, 0, sw, sh);
          const pixels = imageData.data;
          const getPixel = (px: number, py: number) => {
            const cx = Math.max(0, Math.min(sw - 1, Math.round(px)));
            const cy = Math.max(0, Math.min(sh - 1, Math.round(py)));
            const idx = (cy * sw + cx) * 4;
            return {
              r: pixels[idx],
              g: pixels[idx + 1],
              b: pixels[idx + 2],
              a: pixels[idx + 3],
            };
          };
          const colorDistance = (
            a: { r: number; g: number; b: number; a: number },
            b: { r: number; g: number; b: number; a: number }
          ) => {
            const dr = a.r - b.r;
            const dg = a.g - b.g;
            const db = a.b - b.b;
            return Math.sqrt(dr * dr + dg * dg + db * db);
          };
          const averageColor = (samples: Array<{ r: number; g: number; b: number; a: number }>) => ({
            r: samples.reduce((acc, c) => acc + c.r, 0) / samples.length,
            g: samples.reduce((acc, c) => acc + c.g, 0) / samples.length,
            b: samples.reduce((acc, c) => acc + c.b, 0) / samples.length,
            a: samples.reduce((acc, c) => acc + c.a, 0) / samples.length,
          });

          const cornerSamples = [
            getPixel(0, 0),
            getPixel(sw - 1, 0),
            getPixel(0, sh - 1),
            getPixel(sw - 1, sh - 1),
          ];
          const background = averageColor(cornerSamples);
          const bgSpread = Math.max(
            ...cornerSamples.map((sample) => colorDistance(sample, background))
          );
          const bgThreshold = Math.max(18, Math.min(52, bgSpread + 18));

          const pixelLooksLikeBackground = (px: number, py: number) => {
            const sample = getPixel(px, py);
            if (sample.a < 16) return true;
            return colorDistance(sample, background) <= bgThreshold;
          };

          const mask = new Uint8Array(sw * sh);
          for (let yy = 0; yy < sh; yy += 1) {
            for (let xx = 0; xx < sw; xx += 1) {
              mask[yy * sw + xx] = pixelLooksLikeBackground(xx, yy) ? 0 : 1;
            }
          }

          type Component = {
            area: number;
            minX: number;
            minY: number;
            maxX: number;
            maxY: number;
            cx: number;
            cy: number;
          };

          const visited = new Uint8Array(sw * sh);
          const components: Component[] = [];
          const queueX = new Int32Array(sw * sh);
          const queueY = new Int32Array(sw * sh);

          for (let yy = 0; yy < sh; yy += 1) {
            for (let xx = 0; xx < sw; xx += 1) {
              const startIndex = yy * sw + xx;
              if (!mask[startIndex] || visited[startIndex]) continue;

              let head = 0;
              let tail = 0;
              let area = 0;
              let sumX = 0;
              let sumY = 0;
              let minX = xx;
              let minY = yy;
              let maxX = xx;
              let maxY = yy;

              visited[startIndex] = 1;
              queueX[tail] = xx;
              queueY[tail] = yy;
              tail += 1;

              while (head < tail) {
                const cx = queueX[head];
                const cy = queueY[head];
                head += 1;

                area += 1;
                sumX += cx;
                sumY += cy;
                if (cx < minX) minX = cx;
                if (cy < minY) minY = cy;
                if (cx > maxX) maxX = cx;
                if (cy > maxY) maxY = cy;

                const neighbors = [
                  [cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1],
                ];
                for (const [nx, ny] of neighbors) {
                  if (nx < 0 || ny < 0 || nx >= sw || ny >= sh) continue;
                  const ni = ny * sw + nx;
                  if (!mask[ni] || visited[ni]) continue;
                  visited[ni] = 1;
                  queueX[tail] = nx;
                  queueY[tail] = ny;
                  tail += 1;
                }
              }

              const compWidth = maxX - minX + 1;
              const compHeight = maxY - minY + 1;
              const aspect = compWidth / Math.max(1, compHeight);
              const minArea = Math.max(24, Math.round(sw * sh * 0.008));
              const isReasonableAvatarShape = aspect >= 0.6 && aspect <= 1.45;

              if (area >= minArea && isReasonableAvatarShape) {
                components.push({
                  area,
                  minX,
                  minY,
                  maxX,
                  maxY,
                  cx: sumX / area,
                  cy: sumY / area,
                });
              }
            }
          }

          const cropNormWidth = Math.max(0.000001, paddedX2 - paddedX1);
          const cropNormHeight = Math.max(0.000001, paddedY2 - paddedY1);
          const bboxLeftInCrop = Math.round(((x1 - paddedX1) / cropNormWidth) * sw);
          const bboxTopInCrop = Math.round(((y1 - paddedY1) / cropNormHeight) * sh);
          const bboxWidthInCrop = Math.max(1, Math.round(((x2 - x1) / cropNormWidth) * sw));
          const bboxHeightInCrop = Math.max(1, Math.round(((y2 - y1) / cropNormHeight) * sh));
          const bboxCenterX = bboxLeftInCrop + bboxWidthInCrop / 2;
          const bboxCenterY = bboxTopInCrop + bboxHeightInCrop / 2;

          const bestCandidate = components
            .map((component) => {
              const width = component.maxX - component.minX + 1;
              const height = component.maxY - component.minY + 1;
              const aspect = width / Math.max(1, height);
              const aspectScore = 1 - Math.min(1, Math.abs(1 - aspect) / 0.45);
              const fillRatio = component.area / Math.max(1, width * height);
              const fillScore = Math.min(1, fillRatio / 0.5);
              const centerDx = Math.abs(component.cx - bboxCenterX) / Math.max(1, sw / 2);
              const centerDy = Math.abs(component.cy - bboxCenterY) / Math.max(1, sh / 2);
              const centerPenalty = (centerDx + centerDy) * 0.8;
              const edgePenalty = (width < sw * 0.22 || height < sh * 0.22) ? 0.6 : 1;
              const score = component.area * (0.4 + aspectScore * 0.4 + fillScore * 0.2) * (1 - centerPenalty) * edgePenalty;
              return { component, score };
            })
            .sort((a, b) => b.score - a.score)[0];

          const fallbackSide = Math.min(Math.max(bboxWidthInCrop, bboxHeightInCrop), sw, sh);
          let squareLeft = Math.round(bboxLeftInCrop - (fallbackSide - bboxWidthInCrop) / 2);
          let squareTop = Math.round(bboxTopInCrop - (fallbackSide - bboxHeightInCrop) / 2);
          squareLeft = Math.max(0, Math.min(sw - fallbackSide, squareLeft));
          squareTop = Math.max(0, Math.min(sh - fallbackSide, squareTop));
          let squareSide = fallbackSide;

          const fallbackArea = bboxWidthInCrop * bboxHeightInCrop;
          if (bestCandidate && bestCandidate.component.area >= fallbackArea * 0.35) {
            const bestComponent = bestCandidate.component;
            const width = bestComponent.maxX - bestComponent.minX + 1;
            const height = bestComponent.maxY - bestComponent.minY + 1;
            const side = Math.min(Math.max(width, height), sw, sh);
            squareLeft = Math.round(bestComponent.minX - (side - width) / 2);
            squareTop = Math.round(bestComponent.minY - (side - height) / 2);
            squareLeft = Math.max(0, Math.min(sw - side, squareLeft));
            squareTop = Math.max(0, Math.min(sh - side, squareTop));
            squareSide = side;
          }

          const insetProbe = Math.max(1, Math.round(squareSide * 0.08));
          const circularBgHits = [
            pixelLooksLikeBackground(squareLeft + insetProbe, squareTop + insetProbe),
            pixelLooksLikeBackground(squareLeft + squareSide - insetProbe, squareTop + insetProbe),
            pixelLooksLikeBackground(squareLeft + insetProbe, squareTop + squareSide - insetProbe),
            pixelLooksLikeBackground(squareLeft + squareSide - insetProbe, squareTop + squareSide - insetProbe),
          ].filter(Boolean).length;
          const isLikelyCircularAvatar = circularBgHits >= 3;

          const innerInset = isLikelyCircularAvatar ? Math.max(2, Math.round(squareSide * 0.05)) : 0;
          squareLeft = Math.max(0, Math.min(sw - 1, squareLeft + innerInset));
          squareTop = Math.max(0, Math.min(sh - 1, squareTop + innerInset));
          squareSide = Math.max(32, Math.min(sw - squareLeft, sh - squareTop, squareSide - innerInset * 2));

          const outputSize = 1920;
          const canvas = document.createElement('canvas');
          canvas.width = outputSize;
          canvas.height = outputSize;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(objectUrl);
            return resolve(null);
          }

          ctx.clearRect(0, 0, outputSize, outputSize);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          if (isLikelyCircularAvatar) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2 - 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
          }
          ctx.drawImage(rawCanvas, squareLeft, squareTop, squareSide, squareSide, 0, 0, outputSize, outputSize);
          if (isLikelyCircularAvatar) ctx.restore();

          canvas.toBlob((b) => {
            URL.revokeObjectURL(objectUrl);
            resolve(b);
          }, 'image/png');
        } catch {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      img.src = objectUrl;
    });
  };

  const cropImageByBboxSimple = async (
    source: Blob,
    bbox: { x: number; y: number; width: number; height: number }
  ): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(source);
      img.onload = () => {
        try {
          const W = img.naturalWidth;
          const H = img.naturalHeight;
          const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
          const x1 = clamp01(bbox.x);
          const y1 = clamp01(bbox.y);
          const x2 = clamp01(bbox.x + bbox.width);
          const y2 = clamp01(bbox.y + bbox.height);
          const sx = Math.round(x1 * W);
          const sy = Math.round(y1 * H);
          const sw = Math.max(1, Math.round((x2 - x1) * W));
          const sh = Math.max(1, Math.round((y2 - y1) * H));
          const side = Math.min(Math.max(sw, sh), W, H);
          const squareX = Math.max(0, Math.min(W - side, Math.round(sx - (side - sw) / 2)));
          const squareY = Math.max(0, Math.min(H - side, Math.round(sy - (side - sh) / 2)));

          const canvas = document.createElement('canvas');
          canvas.width = 1920;
          canvas.height = 1920;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(objectUrl);
            return resolve(null);
          }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, squareX, squareY, side, side, 0, 0, 1920, 1920);
          canvas.toBlob((b) => {
            URL.revokeObjectURL(objectUrl);
            resolve(b);
          }, 'image/png');
        } catch {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      img.src = objectUrl;
    });
  };

  const extractVideoFrame = (file: File): Promise<Blob | null> => {
    return new Promise((resolve) => {
      try {
        const video = document.createElement('video');
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        video.src = URL.createObjectURL(file);
        video.onloadeddata = () => {
          // Tenta um frame perto do início (1s ou 10% da duração)
          const t = Math.min(1, (video.duration || 1) * 0.1);
          video.currentTime = isFinite(t) ? t : 0;
        };
        video.onseeked = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 720;
            canvas.height = video.videoHeight || 1280;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(null);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92);
          } catch {
            resolve(null);
          }
        };
        video.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  };

  const handleAIMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setAiLoading(true);
    const toastId = toast.loading('🤖 Analisando mídia com IA...');
    try {
      let uploadFile: Blob = file;
      let uploadExt = file.name.split('.').pop() || 'bin';
      let uploadMime = file.type;

      // Se for vídeo, extrai um frame como JPEG (Gemini não aceita vídeo via URL)
      if ((file.type || '').startsWith('video/')) {
        toast.loading('🎞️ Extraindo frame do vídeo...', { id: toastId });
        const frame = await extractVideoFrame(file);
        if (!frame) throw new Error('Não foi possível extrair um frame do vídeo. Tente uma imagem.');
        uploadFile = frame;
        uploadExt = 'jpg';
        uploadMime = 'image/jpeg';
        toast.loading('🤖 Analisando mídia com IA...', { id: toastId });
      }

      const path = `ai-extract/${crypto.randomUUID()}.${uploadExt}`;
      const { error: upErr } = await supabase.storage.from('media').upload(path, uploadFile, { upsert: true, contentType: uploadMime });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);

      const { data, error } = await supabase.functions.invoke('contact-from-media', {
        body: { mediaUrl: urlData.publicUrl, mimeType: uploadMime },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const extracted = data.contact || {};
      const bbox = extracted.profile_photo_bbox as
        | { x: number; y: number; width: number; height: number }
        | undefined;

      // Abre o editor interativo de recorte com a imagem ORIGINAL e o bbox sugerido pela IA.
      // O usuário ajusta manualmente até centralizar a foto de perfil exatamente onde quiser.
      setCropEditor({ blob: uploadFile, bbox: (extracted.has_profile_photo && bbox && typeof bbox.x === 'number') ? bbox : null });

      setForm(prev => {
        const merged: any = { ...prev };
        Object.entries(extracted).forEach(([k, v]) => {
          if (['confidence', 'has_profile_photo', 'profile_photo_bbox'].includes(k)) return;
          if (v === undefined || v === null || v === '') return;
          if (k === 'name') {
            merged.name = v;
            return;
          }
          if (!merged[k] || merged[k] === '') {
            merged[k] = v;
          }
        });
        return merged;
      });
      setShowDetails(true);
      toast.success(`✨ Dados extraídos! Ajuste o recorte da foto e salve.`, { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao analisar mídia', { id: toastId });
    } finally {
      setAiLoading(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) requestDismiss(); else onOpenChange(true); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="flex items-center gap-2">
            {contact ? 'Editar' : 'Novo'} Contato
            {contact && hasOrders(contact.id) && (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-400 dark:border-green-700">
                <ShoppingCart className="h-3 w-3" />
                Cliente
              </span>
            )}
          </DialogTitle>
          <div className="flex items-center gap-2">
            <input
              ref={aiFileRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleAIMediaUpload}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-950/30"
              onClick={() => aiFileRef.current?.click()}
              disabled={aiLoading}
              type="button"
            >
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              IA: Extrair de mídia
            </Button>
            {contact && (
              <Button
                variant="outline"
                className="gap-1 border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => {
                  if (location.pathname === '/contatos' && exitReason) { toast.warning(exitReason); return; }
                  const params = new URLSearchParams({
                    tab: 'orders',
                    newOrder: 'true',
                    contactId: contact.id,
                    contactName: contact.name || '',
                    contactPhone: contact.phone || contact.whatsapp || contact.mobile || '',
                    contactEmail: contact.email || '',
                    ...(contact.notes ? { contactNotes: contact.notes } : {}),
                  });
                  onOpenChange(false);
                  navigate(`/operacoes?${params.toString()}`);
                }}
              >
                <ShoppingCart className="h-4 w-4" />
                Novo Pedido
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={loading} className="bg-green-600 hover:bg-green-700">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-5">
          {cropEditor && (
            <AvatarCropEditor
              sourceBlob={cropEditor.blob}
              initialBbox={cropEditor.bbox}
              onConfirm={(url) => {
                updateField('photo_url', url);
                setCropEditor(null);
                toast.success('Foto de perfil aplicada!');
              }}
              onCancel={() => setCropEditor(null)}
            />
          )}
          {/* === ESSENCIAL === */}
          <section className="space-y-4">
            <div className="flex items-start gap-4">
              <ContactAvatar
                photoUrl={form.photo_url}
                name={form.name}
                size="lg"
                editable
                onPhotoChange={(url) => updateField('photo_url', url)}
              />
              <div className="flex-1 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome *</Label>
                  <Input id="name" value={form.name || ''} onChange={(e) => updateField('name', e.target.value)} placeholder="Nome do contato" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Tipo de Contato</Label>
                    <Select value={form.contact_type || ''} onValueChange={(v) => updateField('contact_type', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {CONTACT_SUBTYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cliente/Forn.</Label>
                    <Select value={form.type || 'cliente'} onValueChange={(v) => updateField('type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cliente">Cliente</SelectItem>
                        <SelectItem value="fornecedor">Fornecedor</SelectItem>
                        <SelectItem value="ambos">Ambos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Classificação do Cliente</Label>
                  <Select value={form.client_classification || ''} onValueChange={(v) => updateField('client_classification' as any, v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vip">🟢 Cliente VIP</SelectItem>
                      <SelectItem value="alto_potencial">🔵 Cliente Alto Potencial</SelectItem>
                      <SelectItem value="medio">🟡 Cliente Médio</SelectItem>
                      <SelectItem value="baixo_potencial">⚪ Cliente Baixo Potencial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="whatsapp" className="flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                  WhatsApp
                </Label>
                <div className="relative">
                  <Input id="whatsapp" value={form.whatsapp || ''} onChange={(e) => updateField('whatsapp', e.target.value)} placeholder="(00) 00000-0000" />
                  {form.whatsapp && (
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 text-green-600 hover:text-green-700" onClick={handleWhatsAppClick}>
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Cidade / Bairro</Label>
                <div className="flex gap-2">
                  <Input value={form.city || ''} onChange={(e) => updateField('city', e.target.value)} placeholder="Cidade" className="flex-1" />
                  <Input value={form.neighborhood || ''} onChange={(e) => updateField('neighborhood', e.target.value)} placeholder="Bairro" className="flex-1" />
                </div>
              </div>
            </div>

            {/* Próximo passo: uma única decisão alimenta ação e fila de contato */}
            <div className="rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 p-3 space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Próximo passo</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input 
                  value={form.next_action_text || ''} 
                  onChange={(e) => updateField('next_action_text' as any, e.target.value)} 
                  placeholder="O que deve ser feito? Ex: confirmar pedido"
                />
                <Input 
                  type="datetime-local" 
                  value={form.next_action_date ? (() => { try { const d = parseISO(form.next_action_date); return format(d, "yyyy-MM-dd'T'HH:mm"); } catch { return ''; } })() : ''}
                  onChange={(e) => {
                    const value = e.target.value ? new Date(e.target.value).toISOString() : '';
                    updateField('next_action_date' as any, value);
                    updateField('next_contact_date' as any, value);
                  }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Defina a ação e quando ela deve aparecer na sua fila de atendimento.</p>
            </div>

            {/* Origem da Campanha */}
            <div className="rounded-lg border bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800 p-3 space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">📣 Origem da Campanha</Label>
              <Select value={form.campaign_idea_id || '_none'} onValueChange={(v) => updateField('campaign_idea_id' as any, v === '_none' ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Vincular a uma ideia do Digital..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nenhuma</SelectItem>
                  {ideas.map(idea => (
                    <SelectItem key={idea.id} value={idea.id}>{idea.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Vincule este contato a uma campanha do módulo Digital para rastreabilidade</p>
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.notes || ''} onChange={(e) => updateField('notes', e.target.value)} rows={2} placeholder="Observações gerais..." />
            </div>
          </section>

          {/* === MAIS DETALHES (colapsável) === */}
          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between text-sm text-muted-foreground hover:text-foreground">
                <span>Mais detalhes (CPF, endereço, financeiro...)</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", showDetails && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-6 pt-2">
              {/* Dados Cadastrais */}
              <section>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Dados cadastrais</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Fantasia</Label>
                    <Input value={form.fantasy_name || ''} onChange={(e) => updateField('fantasy_name', e.target.value)} placeholder="Nome fantasia" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Código</Label>
                    <Input value={form.code || ''} onChange={(e) => updateField('code', e.target.value)} placeholder="Código interno" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo de Pessoa</Label>
                    <Select value={form.person_type || 'fisica'} onValueChange={(v) => updateField('person_type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fisica">Pessoa Física</SelectItem>
                        <SelectItem value="juridica">Pessoa Jurídica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
                  <div className="space-y-1.5">
                    <Label>{form.person_type === 'juridica' ? 'CNPJ' : 'CPF'}</Label>
                    <Input value={form.document || ''} onChange={(e) => updateField('document', e.target.value)} placeholder={form.person_type === 'juridica' ? '00.000.000/0000-00' : '000.000.000-00'} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>RG</Label>
                    <Input value={form.rg || ''} onChange={(e) => updateField('rg', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Órgão Emissor</Label>
                    <Input value={form.issuing_agency || ''} onChange={(e) => updateField('issuing_agency', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cliente desde</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.customer_since ? format(parseISO(form.customer_since), 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={form.customer_since ? parseISO(form.customer_since) : undefined} onSelect={(date) => updateField('customer_since', date?.toISOString().split('T')[0])} locale={ptBR} className="pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  <div className="space-y-1.5">
                    <Label>Contribuinte</Label>
                    <Select value={form.taxpayer_type || '9'} onValueChange={(v) => updateField('taxpayer_type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TAXPAYER_TYPES.map(t => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Inscrição Estadual</Label>
                    <Input value={form.state_registration || ''} onChange={(e) => updateField('state_registration', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Vendedor</Label>
                    <Input value={form.salesperson || ''} onChange={(e) => updateField('salesperson', e.target.value)} />
                  </div>
                </div>
              </section>

              {/* Contato */}
              <section>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Contato</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <Input value={form.phone || ''} onChange={(e) => updateField('phone', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Celular</Label>
                    <Input value={form.mobile || ''} onChange={(e) => updateField('mobile', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>E-mail</Label>
                    <Input type="email" value={form.email || ''} onChange={(e) => updateField('email', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fone fixo</Label>
                    <Input value={form.landline || ''} onChange={(e) => updateField('landline', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  <div className="space-y-1.5">
                    <Label>E-Mail NFe</Label>
                    <Input type="email" value={form.nfe_email || ''} onChange={(e) => updateField('nfe_email', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Website</Label>
                    <Input value={form.website || ''} onChange={(e) => updateField('website', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Operadora</Label>
                    <Select value={form.mobile_carrier || ''} onValueChange={(v) => updateField('mobile_carrier', v)}>
                      <SelectTrigger><SelectValue placeholder="Operadora" /></SelectTrigger>
                      <SelectContent>
                        {MOBILE_CARRIERS.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Próxima visita</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.next_visit ? format(parseISO(form.next_visit), 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={form.next_visit ? parseISO(form.next_visit) : undefined} onSelect={(date) => updateField('next_visit', date?.toISOString().split('T')[0])} locale={ptBR} className="pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </section>

              {/* Endereço */}
              <section>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Endereço</h3>
                <Tabs value={addressTab} onValueChange={setAddressTab}>
                  <TabsList>
                    <TabsTrigger value="geral">Geral</TabsTrigger>
                    <TabsTrigger value="cobranca">Cobrança</TabsTrigger>
                  </TabsList>
                  <TabsContent value="geral" className="space-y-3 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="space-y-1.5">
                        <Label>CEP</Label>
                        <div className="relative">
                          <Input value={form.zip_code || ''} onChange={(e) => updateField('zip_code', e.target.value)} onBlur={(e) => handleCepSearch(e.target.value)} placeholder="00000-000" />
                          <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" onClick={() => handleCepSearch(form.zip_code || '')}><Search className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>UF</Label>
                        <Select value={form.state || ''} onValueChange={(v) => updateField('state', v)}>
                          <SelectTrigger><SelectValue placeholder="UF..." /></SelectTrigger>
                          <SelectContent>{BRAZILIAN_STATES.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Cidade</Label>
                        <Input value={form.city || ''} onChange={(e) => updateField('city', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Bairro</Label>
                        <Input value={form.neighborhood || ''} onChange={(e) => updateField('neighborhood', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label>Endereço</Label>
                        <Input value={form.address || ''} onChange={(e) => updateField('address', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Número</Label>
                        <Input value={form.address_number || ''} onChange={(e) => updateField('address_number', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Complemento</Label>
                        <Input value={form.address_complement || ''} onChange={(e) => updateField('address_complement', e.target.value)} />
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="cobranca" className="space-y-3 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="space-y-1.5">
                        <Label>CEP</Label>
                        <div className="relative">
                          <Input value={form.billing_zip_code || ''} onChange={(e) => updateField('billing_zip_code', e.target.value)} onBlur={(e) => handleCepSearch(e.target.value, true)} placeholder="00000-000" />
                          <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" onClick={() => handleCepSearch(form.billing_zip_code || '', true)}><Search className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>UF</Label>
                        <Select value={form.billing_state || ''} onValueChange={(v) => updateField('billing_state', v)}>
                          <SelectTrigger><SelectValue placeholder="UF..." /></SelectTrigger>
                          <SelectContent>{BRAZILIAN_STATES.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Cidade</Label>
                        <Input value={form.billing_city || ''} onChange={(e) => updateField('billing_city', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Bairro</Label>
                        <Input value={form.billing_neighborhood || ''} onChange={(e) => updateField('billing_neighborhood', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label>Endereço</Label>
                        <Input value={form.billing_address || ''} onChange={(e) => updateField('billing_address', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Número</Label>
                        <Input value={form.billing_number || ''} onChange={(e) => updateField('billing_number', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Complemento</Label>
                        <Input value={form.billing_complement || ''} onChange={(e) => updateField('billing_complement', e.target.value)} />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </section>

              {/* Dados Adicionais */}
              <section>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Dados adicionais</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label>Estado civil</Label>
                    <Select value={form.marital_status || ''} onValueChange={(v) => updateField('marital_status', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{MARITAL_STATUS.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Profissão</Label>
                    <Input value={form.profession || ''} onChange={(e) => updateField('profession', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sexo</Label>
                    <Select value={form.gender || ''} onValueChange={(v) => updateField('gender', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{GENDERS.map(g => (<SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data Nascimento</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.birth_date ? format(parseISO(form.birth_date), 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={form.birth_date ? parseISO(form.birth_date) : undefined} onSelect={(date) => updateField('birth_date', date?.toISOString().split('T')[0])} locale={ptBR} className="pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  <div className="space-y-1.5">
                    <Label>Naturalidade</Label>
                    <Input value={form.birthplace || ''} onChange={(e) => updateField('birthplace', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nome do Pai</Label>
                    <Input value={form.father_name || ''} onChange={(e) => updateField('father_name', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nome da Mãe</Label>
                    <Input value={form.mother_name || ''} onChange={(e) => updateField('mother_name', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Situação</Label>
                    <Select value={form.is_active ? 'ativo' : 'inativo'} onValueChange={(v) => updateField('is_active', v === 'ativo')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* Financeiro */}
              <section>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Financeiro</h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Limite de crédito</Label>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch checked={form.credit_limit_type === 'unlimited'} onCheckedChange={(checked) => updateField('credit_limit_type', checked ? 'unlimited' : 'custom')} />
                        <span className="text-sm">Ilimitado</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={form.credit_limit_type === 'zero'} onCheckedChange={(checked) => updateField('credit_limit_type', checked ? 'zero' : 'unlimited')} />
                        <span className="text-sm">Limite zero</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Condição de pagamento</Label>
                      <Input value={form.payment_condition || ''} onChange={(e) => updateField('payment_condition', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Categoria</Label>
                      <Select value={form.category || ''} onValueChange={(v) => updateField('category', v)}>
                        <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sem_categoria">Sem categoria</SelectItem>
                          <SelectItem value="vip">VIP</SelectItem>
                          <SelectItem value="regular">Regular</SelectItem>
                          <SelectItem value="novo">Novo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </section>

              {/* Canais de Venda */}
              <section>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Canais de Venda (Jornada)</h3>
                <p className="text-xs text-muted-foreground mb-2">Rastreie por quais canais este cliente chegou até você.</p>
                {(() => {
                  const channels: Array<{ platform_id: string; added_at: string }> = (form.sales_channels as any) || [];
                  const getPlatformInfo = (id: string) => activePlatforms.find(p => p.id === id);
                  const addChannel = (platformId: string) => {
                    const updated = [...channels, { platform_id: platformId, added_at: new Date().toISOString() }];
                    updateField('sales_channels' as any, updated);
                  };
                  const removeChannel = (index: number) => {
                    const updated = channels.filter((_, i) => i !== index);
                    updateField('sales_channels' as any, updated);
                  };
                  return (
                    <div className="space-y-2">
                      {channels.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {channels.map((ch, i) => {
                            const p = getPlatformInfo(ch.platform_id);
                            return (
                              <div key={i} className="flex items-center">
                                {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground mx-0.5" />}
                                <Badge variant="secondary" className="text-xs gap-1 pr-1">
                                  <span>{p?.icon || '📱'}</span>
                                  <span>{p?.name || 'Canal'}</span>
                                  <button onClick={() => removeChannel(i)} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="w-[260px]">
                        <PlatformHierarchicalPicker
                          platforms={activePlatforms}
                          value={null}
                          onChange={(id) => { if (id) addChannel(id); }}
                          placeholder="+ Adicionar canal..."
                          excludedPlatformIds={channels.map(c => c.platform_id)}
                          size="sm"
                        />
                      </div>
                    </div>
                  );
                })()}
              </section>
            </CollapsibleContent>
          </Collapsible>

          {/* Pedidos do Cliente */}
          {contact && (
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-90" />
                Pedidos do Cliente
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 pb-4">
                <ContactOrdersList contactId={contact.id} onClose={requestDismiss} />
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Timeline — aberta por padrão para visibilidade imediata do histórico */}
          {contact && (
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-90" />
                📜 Linha do tempo (histórico de conversas)
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 pb-4">
                <ContactTimeline contactId={contact.id} createdAt={contact.created_at} />
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </DialogContent>

      <WhatsAppMessageSelector
        open={whatsAppOpen}
        onOpenChange={setWhatsAppOpen}
        contactName={form.name || ''}
        funnelStatus={form.funnel_status || ''}
        contactId={contact?.id}
        onSend={handleWhatsAppSend}
      />
    </Dialog>
  );
}
