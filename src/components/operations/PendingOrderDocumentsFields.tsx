import { useRef, useState } from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ORDER_DOCUMENT_TYPE_LABELS, SUPPORTED_ORDER_DOCUMENT_MIME_TYPES } from '@/lib/orders/orderDocuments';
import type { OrderDocumentType, PendingOrderDocument } from '@/lib/orders/orderDocuments';

interface PendingOrderDocumentsFieldsProps {
  value: PendingOrderDocument[];
  onChange: (documents: PendingOrderDocument[]) => void;
}

export function PendingOrderDocumentsFields({ value, onChange }: PendingOrderDocumentsFieldsProps) {
  const [documentType, setDocumentType] = useState<OrderDocumentType>('other');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectFile = (nextFile: File | null) => {
    if (!nextFile) {
      setFile(null);
      return;
    }
    if (!SUPPORTED_ORDER_DOCUMENT_MIME_TYPES.includes(nextFile.type as typeof SUPPORTED_ORDER_DOCUMENT_MIME_TYPES[number])) {
      setError('Selecione um arquivo PDF, JPG, PNG ou WebP.');
      setFile(null);
      return;
    }
    setError('');
    setFile(nextFile);
  };

  const addDocument = () => {
    if (!file) {
      setError('Selecione um arquivo PDF, JPG, PNG ou WebP.');
      return;
    }
    onChange([...value, { id: crypto.randomUUID(), documentType, file }]);
    setFile(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return <section className="space-y-3 rounded-lg border bg-muted/20 p-3">
    <Label className="text-sm font-semibold">DOCUMENTOS DO PEDIDO</Label>
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end">
      <div>
        <Label className="text-xs">Tipo</Label>
        <Select value={documentType} onValueChange={value => setDocumentType(value as OrderDocumentType)}>
          <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(ORDER_DOCUMENT_TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Arquivo</Label>
        <Input ref={fileInputRef} className="mt-1 h-10" type="file" accept={SUPPORTED_ORDER_DOCUMENT_MIME_TYPES.join(',')} onChange={event => selectFile(event.target.files?.[0] ?? null)} />
      </div>
      <Button type="button" variant="outline" className="h-10" onClick={addDocument}><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
    </div>
    <p className="text-xs text-muted-foreground">PDF, JPG, PNG ou WebP</p>
    {error && <p className="text-xs text-destructive">{error}</p>}
    {value.length > 0 && <div className="space-y-1 rounded-md border bg-background p-2">{value.map(document => <div key={document.id} className="flex items-center justify-between gap-2 text-xs"><span className="min-w-0 truncate"><FileText className="mr-1 inline h-3.5 w-3.5" />{ORDER_DOCUMENT_TYPE_LABELS[document.documentType]} · {document.file.name}</span><Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={`Remover ${document.file.name}`} onClick={() => onChange(value.filter(item => item.id !== document.id))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></div>)}</div>}
  </section>;
}
