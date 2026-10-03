import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users, Plus, Pencil, Trash2, Mail, Briefcase,
  Factory, Calendar, CheckCircle, XCircle, Camera
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppUser {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  is_active: boolean;
  created_at: string;
  avatar_url: string | null;
}

interface CollaboratorStats {
  productionEntries: number;
  meetingsAsOwner: number;
  meetingsAsParticipant: number;
}

interface CollaboratorsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function CollaboratorsPanel({ open, onOpenChange }: CollaboratorsPanelProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [stats, setStats] = useState<Record<string, CollaboratorStats>>({});
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "",
    avatar_url: "" as string,
  });
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (open) fetchUsers();
  }, [open]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: usersData, error: usersError } = await (supabase as any)
      .from("app_users")
      .select("id,name,email,role,is_active,created_at,avatar_url")
      .order("name");

    if (usersError) {
      toast({ variant: "destructive", title: "Erro ao carregar colaboradores" });
      setLoading(false);
      return;
    }

    const list = (usersData || []) as AppUser[];
    setUsers(list);

    const statsMap: Record<string, CollaboratorStats> = {};
    for (const user of list) {
      const { count: prodCount } = await supabase
        .from("production_entries")
        .select("*", { count: "exact", head: true })
        .ilike("employee_name", user.name);

      const { count: ownerCount } = await supabase
        .from("meetings")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", user.id);

      const { count: participantCount } = await supabase
        .from("meeting_participants")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      statsMap[user.id] = {
        productionEntries: prodCount || 0,
        meetingsAsOwner: ownerCount || 0,
        meetingsAsParticipant: participantCount || 0,
      };
    }

    setStats(statsMap);
    setLoading(false);
  };

  const resetAvatarState = (url?: string | null) => {
    setAvatarFile(null);
    setAvatarPreview(url || null);
  };

  const handleCreate = () => {
    setEditingUser(null);
    setFormData({ name: "", email: "", role: "", avatar_url: "" });
    resetAvatarState(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (user: AppUser) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email || "",
      role: user.role || "",
      avatar_url: user.avatar_url || "",
    });
    resetAvatarState(user.avatar_url);
    setIsDialogOpen(true);
  };

  const handleAvatarChange = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "Selecione uma imagem" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "A foto deve ter no máximo 5 MB" });
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const uploadAvatar = async (userId: string, file: File) => {
    const path = `${userId}/avatar`;
    const { error } = await supabase.storage
      .from("app-user-avatars")
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });
    if (error) throw error;
    const { data } = supabase.storage.from("app-user-avatars").getPublicUrl(path);
    return `${data.publicUrl}?v=${Date.now()}`;
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ variant: "destructive", title: "Nome é obrigatório" });
      return;
    }

    setSaving(true);
    try {
      let userId = editingUser?.id || "";

      if (editingUser) {
        const { error } = await (supabase as any)
          .from("app_users")
          .update({
            name: formData.name.trim(),
            email: formData.email.trim() || null,
            role: formData.role.trim() || null,
          })
          .eq("id", editingUser.id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("app_users")
          .insert({
            name: formData.name.trim(),
            email: formData.email.trim() || null,
            role: formData.role.trim() || null,
          })
          .select("id")
          .single();
        if (error) throw error;
        userId = data.id;
      }

      if (avatarFile && userId) {
        const avatarUrl = await uploadAvatar(userId, avatarFile);
        const { error } = await (supabase as any)
          .from("app_users")
          .update({ avatar_url: avatarUrl })
          .eq("id", userId);
        if (error) throw error;
      }

      toast({ title: editingUser ? "Colaborador atualizado" : "Colaborador criado" });
      setIsDialogOpen(false);
      await fetchUsers();
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Erro ao salvar colaborador" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user: AppUser) => {
    const { error } = await supabase
      .from("app_users")
      .update({ is_active: !user.is_active })
      .eq("id", user.id);

    if (error) {
      toast({ variant: "destructive", title: "Erro ao alterar status" });
      return;
    }
    toast({ title: user.is_active ? "Colaborador desativado" : "Colaborador ativado" });
    fetchUsers();
  };

  const handleDelete = async (user: AppUser) => {
    if (!confirm(`Excluir ${user.name}?`)) return;
    const { error } = await supabase.from("app_users").delete().eq("id", user.id);
    if (error) {
      toast({ variant: "destructive", title: "Erro ao excluir" });
      return;
    }
    toast({ title: "Colaborador excluído" });
    fetchUsers();
  };

  const getRoleColor = (role: string | null) => {
    if (!role) return "bg-muted text-muted-foreground";
    const lower = role.toLowerCase();
    if (lower.includes("produção") || lower.includes("producao")) return "bg-node-laranja/20 text-node-laranja";
    if (lower.includes("gestão") || lower.includes("gestao") || lower.includes("gerente")) return "bg-node-roxo/20 text-node-roxo";
    if (lower.includes("marketing")) return "bg-node-azul/20 text-node-azul";
    if (lower.includes("financeiro")) return "bg-node-verde/20 text-node-verde";
    if (lower.includes("vendas")) return "bg-node-amarelo/20 text-node-amarelo";
    return "bg-primary/20 text-primary";
  };

  const content = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          {users.filter((u) => u.is_active).length} ativos de {users.length} total
        </div>
        <Button onClick={handleCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Novo
        </Button>
      </div>

      <ScrollArea className="flex-1 -mx-4 px-4">
        <div className="space-y-3 pb-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum colaborador cadastrado</div>
          ) : (
            users.map((user) => (
              <Card key={user.id} className={cn("transition-opacity", !user.is_active && "opacity-50")}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <Avatar className="h-12 w-12 shrink-0">
                        {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.name} />}
                        <AvatarFallback className="font-bold">{initials(user.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{user.name}</span>
                          {user.role && (
                            <Badge variant="secondary" className={cn("text-xs shrink-0", getRoleColor(user.role))}>
                              <Briefcase className="h-3 w-3 mr-1" /> {user.role}
                            </Badge>
                          )}
                          {!user.is_active && <Badge variant="outline" className="text-xs">Inativo</Badge>}
                        </div>
                        {user.email && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Mail className="h-3 w-3" /> <span className="truncate">{user.email}</span>
                          </div>
                        )}
                        {stats[user.id] && (
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            {stats[user.id].productionEntries > 0 && (
                              <div className="flex items-center gap-1">
                                <Factory className="h-3 w-3 text-node-laranja" />
                                <span>{stats[user.id].productionEntries} prod.</span>
                              </div>
                            )}
                            {(stats[user.id].meetingsAsOwner + stats[user.id].meetingsAsParticipant) > 0 && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-node-azul" />
                                <span>{stats[user.id].meetingsAsOwner + stats[user.id].meetingsAsParticipant} reuniões</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEdit(user)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleToggleActive(user)}>
                        {user.is_active ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(user)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Editar Colaborador" : "Novo Colaborador"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-3">
              <Avatar className="h-24 w-24 border-2 border-border">
                {avatarPreview && <AvatarImage src={avatarPreview} alt={formData.name || "Colaborador"} />}
                <AvatarFallback className="text-xl font-bold">{formData.name ? initials(formData.name) : <Users className="h-8 w-8" />}</AvatarFallback>
              </Avatar>
              <Label htmlFor="collaborator-avatar" className="cursor-pointer">
                <span className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent">
                  <Camera className="h-4 w-4" /> {avatarPreview ? "Trocar foto" : "Adicionar foto"}
                </span>
              </Label>
              <Input
                id="collaborator-avatar"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => handleAvatarChange(event.target.files?.[0])}
              />
              <p className="text-center text-xs text-muted-foreground">Foto canônica do colaborador. Será usada em Produção e demais módulos.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="email@empresa.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Função</Label>
              <Input id="role" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} placeholder="Ex: Produção, Marketing, Gestão" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : editingUser ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85vh]">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Colaboradores</SheetTitle>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Colaboradores</SheetTitle>
        </SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  );
}
