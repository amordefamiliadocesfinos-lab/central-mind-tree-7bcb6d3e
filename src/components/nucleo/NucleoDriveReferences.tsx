import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Search, ExternalLink, Database } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { NucleoRefsDatabase, NucleoSourceReference } from "@/lib/nucleo/source-references.types";

const PAGE_SIZE = 80;
const M2_TABLE = "nucleo_source_references";

function safeDriveUrl(id: string) {
  return /^[a-zA-Z0-9_-]{10,200}$/.test(id)
    ? "https://drive.google.com/open?id=" + encodeURIComponent(id)
    : null;
}

export default function NucleoDriveReferences() {
  const { session } = useAuth();
  const [authorized, setAuthorized] = useState(false);
  const [items, setItems] = useState<NucleoSourceReference[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAuthorized(false);
    setItems([]);
    setPage(0);
    setSearch("");
    if (!session?.user?.id) return;
    (async () => {
      const { data, error } = await supabase
        .from("app_admin_capabilities" as keyof NucleoRefsDatabase["public"]["Tables"])
        .select("capability")
        .eq("auth_user_id", session.user.id)
        .eq("capability", "nucleo_manage")
        .eq("active", true)
        .is("revoked_at", null)
        .maybeSingle();
      if (!cancelled) setAuthorized(!error && !!data);
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!authorized) return;
    let cancelled = false;
    setBusy(true);
    const client = supabase as unknown as SupabaseClient<NucleoRefsDatabase>;
    (async () => {
      // Busca remota somente em metadados; nenhum conteúdo do Drive é carregado.
      let query = client.from(M2_TABLE)
        .select("id,provider,provider_file_id,source_name,source_mime_type,source_parent_id,source_modified_at,source_checksum_sha256,source_access_class,authority_state,reference_state,provenance_note,content_imported,created_at,recorded_by_auth_uid", { count: "exact" })
        .order("source_name", { ascending: true })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      const term = search.trim().slice(0, 100).replace(/[%,()]/g, "");
      if (term) query = query.ilike("source_name", "%" + term + "%");
      const { data, count, error } = await query;
      if (cancelled) return;
      setUnavailable(!!error);
      setItems(error ? [] : (data ?? []) as NucleoSourceReference[]);
      setTotal(error ? 0 : count ?? 0);
      setBusy(false);
    })();
    return () => { cancelled = true; };
  }, [authorized, page, search]);

  const pageCount = useMemo(() => Math.ceil(total / PAGE_SIZE), [total]);
  if (!authorized) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3" aria-label="Referências documentais do Google Drive">
      <div className="flex items-center gap-2">
        <Database className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-semibold">Referências externas — Google Drive</h2>
        <Badge variant="secondary" className="text-[10px]">Restrito</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Catálogo de metadados sob governança. A referência não comprova vigência ou homologação;
        os documentos originais continuam no Google Drive e sujeitos às permissões de origem.
      </p>
      <div className="relative max-w-lg">
        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <Input
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(0); }}
          placeholder="Pesquisar nome da fonte"
          className="pl-9"
          aria-label="Pesquisar referências pelo nome"
        />
      </div>
      {unavailable ? (
        <p role="status" className="text-xs text-muted-foreground">Catálogo indisponível. Nenhum documento local foi alterado.</p>
      ) : busy ? (
        <p role="status" className="text-xs text-muted-foreground">Consultando referências autorizadas…</p>
      ) : items.length === 0 ? (
        <p role="status" className="text-xs text-muted-foreground">Nenhuma referência disponível nesta consulta.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const url = safeDriveUrl(item.provider_file_id);
            return (
              <div key={item.id} className="rounded-lg border border-border p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium break-words">{item.source_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {item.authority_state.replaceAll("_", " ")} · {item.source_access_class.replaceAll("_", " ")} · {item.reference_state.replaceAll("_", " ")}
                  </p>
                </div>
                {url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      Abrir original <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {pageCount > 1 && (
        <div className="flex items-center justify-between text-xs gap-3">
          <Button variant="outline" size="sm" disabled={page === 0 || busy} onClick={() => setPage((p) => Math.max(0,p-1))}>Anterior</Button>
          <span>Página {page + 1} de {pageCount} · {total} referências</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= pageCount || busy} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
        </div>
      )}
    </section>
  );
}
