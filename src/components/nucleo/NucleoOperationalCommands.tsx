import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { filterOperationalCommands, operationalCommands } from "@/lib/nucleo/operationalCommands";

export default function NucleoOperationalCommands() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const categories = ["Todos", ...new Set(operationalCommands.map(entry => entry.category))];
  const reveal = (id: string) => setExpanded(previous => previous.includes(id) ? previous : [...previous, id]);
  async function copy(id: string, body: string) {
    try {
      await navigator.clipboard.writeText(body);
      setFeedback(previous => ({ ...previous, [id]: "Comando copiado integralmente." }));
    } catch {
      reveal(id);
      setFeedback(previous => ({ ...previous, [id]: "Cópia automática indisponível. Selecione o texto completo abaixo e copie manualmente." }));
    }
  }
  const entries = filterOperationalCommands(query, category);
  return (
    <section aria-labelledby="nucleo-operational-commands" className="mt-5 min-w-0 space-y-4 rounded-2xl border p-3 sm:p-5">
      <div>
        <h3 id="nucleo-operational-commands" className="text-xl font-semibold">Comandos e Skills</h3>
        <p className="text-sm text-muted-foreground">Consulte e copie textos operacionais. Catálogo versionado no GitHub; não executa comandos.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="min-w-0 text-sm">Buscar comando
          <Input className="mt-1" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome ou palavra-chave" />
        </label>
        <label className="min-w-0 text-sm">Categoria
          <select className="mt-1 block h-10 w-full rounded-md border bg-background px-3" value={category} onChange={event => setCategory(event.target.value)}>
            {categories.map(value => <option key={value}>{value}</option>)}
          </select>
        </label>
      </div>
      {entries.length === 0 && <p role="status" className="text-sm">Nenhum comando encontrado.</p>}
      <div className="grid min-w-0 gap-3">
        {entries.map(entry => (
          <article key={entry.id} className="min-w-0 space-y-2 rounded-xl border p-3">
            <p className="text-xs text-muted-foreground">{entry.id} · {entry.category}</p>
            <h4 className="font-semibold">{entry.name}</h4>
            <p className="text-sm">{entry.purpose}</p>
            <p className="text-sm"><strong>Quando usar:</strong> {entry.when}</p>
            <p className="break-words text-xs text-muted-foreground">{entry.version} · {entry.source}</p>
            {entry.body === null ? <p className="text-sm">Texto integral pendente de recuperação. Cópia indisponível.</p> : <>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" aria-expanded={expanded.includes(entry.id)} aria-controls={`command-${entry.id}`} onClick={() => setExpanded(previous => previous.includes(entry.id) ? previous.filter(id => id !== entry.id) : [...previous, entry.id])}>{expanded.includes(entry.id) ? "Recolher comando" : "Ver comando"}</Button>
                <Button type="button" onClick={() => void copy(entry.id, entry.body!)}>Copiar comando</Button>
              </div>
              <p role="status" aria-live="polite" className="text-sm">{feedback[entry.id] || ""}</p>
              <div id={`command-${entry.id}`} hidden={!expanded.includes(entry.id)}>
                <pre tabIndex={0} className="select-text whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-sans text-sm">{entry.body}</pre>
              </div>
            </>}
          </article>
        ))}
      </div>
    </section>
  );
}
