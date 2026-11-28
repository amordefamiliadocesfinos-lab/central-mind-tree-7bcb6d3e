import { useState } from "react";
import { BookOpen, Brain, Check, ChevronDown, ClipboardCheck, Clock, Copy, Route, Search, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { filterOperationalCommands, operationalCommands, operationalCommandInvocation, isOperationalCommandAvailable } from "@/lib/nucleo/operationalCommands";

const categoryIcons = { Continuidade: Route, "Assunção": Brain, "Documentação": ClipboardCheck };
const categories = ["Todos", ...new Set(operationalCommands.map(entry => entry.category))];

export default function NucleoOperationalCommands() {
  const [query, setQuery] = useState("");
  const [secondary, setSecondary] = useState(false);
  const [category, setCategory] = useState("Todos");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Record<string, { ok: boolean; message: string }>>({});
  const available = operationalCommands.filter(isOperationalCommandAvailable).length;
  const reveal = (id: string) => setExpanded(previous => previous.includes(id) ? previous : [...previous, id]);
  async function copy(id: string, body: string, short = false) {
    try {
      await navigator.clipboard.writeText(body);
      setFeedback(previous => ({ ...previous, [id]: { ok: true, message: short ? "Chamada copiada." : "Comando integral copiado." } }));
    } catch {
      reveal(id);
      setFeedback(previous => ({ ...previous, [id]: { ok: false, message: short ? "Selecione a chamada curta nos detalhes e copie manualmente." : "Selecione o texto integral nos detalhes e copie manualmente." } }));
    }
  }
  const filtered = filterOperationalCommands(query, category);
  const entries = filtered.filter(entry => secondary ? !isOperationalCommandAvailable(entry) : isOperationalCommandAvailable(entry));
  return (
    <section aria-labelledby="nucleo-operational-commands" className="mt-5 min-w-0 space-y-3 rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 sm:p-5">
      <header className="flex items-start gap-3">
        <span className="rounded-xl bg-blue-50 p-3 text-blue-700"><Terminal className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0">
          <h3 id="nucleo-operational-commands" className="text-lg font-semibold sm:text-xl">Comandos e Skills</h3>
          <p className="text-sm text-slate-600">Biblioteca operacional · copie e use no ChatGPT.</p>
        </div>
      </header>
      <div className="grid grid-cols-3 gap-2">
        {[[available, "Ativos"], [operationalCommands.filter(e => e.catalogState === "pending").length, "Pendentes"], [operationalCommands.filter(e => e.catalogState === "candidate").length, "Candidatos"]].map(([count, label]) => (
          <div key={label} className="min-w-0 rounded-xl bg-slate-50 p-2 sm:p-3"><p className="text-xl font-semibold tabular-nums">{count}</p><p className="break-words text-xs text-slate-600">{label}</p></div>
        ))}
      </div>
      <div role="group" aria-label="Visibilidade do catálogo" className="flex flex-wrap gap-2"><Button type="button" variant={!secondary ? "default" : "outline"} aria-pressed={!secondary} onClick={() => setSecondary(false)}>Comandos ativos</Button><Button type="button" variant={secondary ? "default" : "outline"} aria-pressed={secondary} onClick={() => setSecondary(true)}>Em curadoria ({operationalCommands.length - available})</Button></div>
      <div className="space-y-2">
        <label className="relative block">
          <span className="sr-only">Buscar por código ou nome</span>
          <Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <Input className="h-11 border-slate-200 bg-white pl-9 text-slate-900" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por código ou nome" />
        </label>
        <div role="group" aria-label="Filtrar por categoria" className="flex flex-wrap gap-2">
          {categories.map(value => <Button key={value} type="button" size="sm" variant="outline" aria-pressed={category === value} className={category === value ? "min-h-10 border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100" : "min-h-10 border-slate-200 bg-white text-slate-700"} onClick={() => setCategory(value)}>{value}</Button>)}
        </div>
      </div>
      {entries.length === 0 && <p role="status" className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Nenhum comando encontrado.</p>}
      <div className="grid min-w-0 grid-cols-1 items-start gap-3 md:grid-cols-2">
        {entries.map(entry => {
          const Icon = categoryIcons[entry.category as keyof typeof categoryIcons] || BookOpen;
          const pending = !isOperationalCommandAvailable(entry);
          const open = expanded.includes(entry.id);
          return (
            <article key={entry.id} className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xl font-semibold text-blue-700"><Icon className="h-4 w-4" aria-hidden="true" />{entry.code}</span>
                <span className="text-xs text-slate-600">{pending ? (entry.catalogState === "candidate" ? "Em revisão" : "Pendente") : entry.authority === "approved" ? "Aprovado" : "Modelo não homologado"}</span>
              </div>
              <h4 className="font-semibold leading-tight">{entry.name}</h4>
              <p className="text-sm text-slate-600">{entry.purpose}</p>
              <div className="flex flex-wrap items-center gap-2">
              {pending ? <p className="flex items-center gap-2 text-xs text-slate-600"><Clock className="h-4 w-4" aria-hidden="true" /> {entry.catalogState === "candidate" ? "Evidência em revisão" : "Fonte em recuperação"} · cópia indisponível</p> : (
                <div className="flex w-full flex-wrap gap-2">
                  <Button type="button" className="min-h-10 min-w-0 flex-1 basis-36 h-auto whitespace-normal gap-2 bg-blue-700 px-2 py-2 text-white hover:bg-blue-800" onClick={() => void copy(entry.id, operationalCommandInvocation(entry.code), true)}><Copy className="h-4 w-4 shrink-0" aria-hidden="true" /> Copiar chamada</Button>
                  <Button type="button" variant="outline" className="min-h-10 min-w-0 flex-1 basis-36 h-auto whitespace-normal gap-2 border-slate-200 bg-white px-2 py-2 text-slate-700" onClick={() => void copy(entry.id, entry.body!)}><Copy className="h-4 w-4 shrink-0" aria-hidden="true" /> Copiar comando integral</Button>
                </div>
              )}
              <Button type="button" variant="ghost" size="sm" className="min-h-10 gap-1 text-slate-700" aria-expanded={open} aria-controls={`command-${entry.id}`} onClick={() => setExpanded(previous => open ? previous.filter(id => id !== entry.id) : [...previous, entry.id])}>{open ? "Recolher detalhes" : "Detalhes"}<ChevronDown className={open ? "h-4 w-4 rotate-180" : "h-4 w-4"} aria-hidden="true" /></Button>
              </div>
              <p role="status" aria-live="polite" className={feedback[entry.id] ? "flex items-start gap-1 text-xs text-slate-700" : "sr-only"}>{feedback[entry.id]?.ok && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}{feedback[entry.id]?.message || ""}</p>
              <div id={`command-${entry.id}`} hidden={!open} className="min-w-0 space-y-3 border-t border-slate-200 pt-3">
                <p className="text-xs text-slate-600"><strong>Quando usar:</strong> {entry.when}</p>
                <p className="break-words text-xs text-slate-600">{entry.version} · {entry.source}</p>
                <p className="text-xs text-slate-600"><strong>Fundamento:</strong> {entry.evidence}</p>
                {!pending && entry.body !== null && <>
                  <p className="select-text break-words rounded-md bg-slate-50 p-2 text-xs text-slate-800">{operationalCommandInvocation(entry.code)}</p>
                  <pre tabIndex={0} className="select-text whitespace-pre-wrap break-words rounded-md bg-slate-50 p-3 font-sans text-sm text-slate-800">{entry.body}</pre>
                </>}
              </div>
            </article>
          );
        })}
      </div>
      <footer className="border-t border-slate-200 pt-3 text-xs text-slate-600">Catálogo versionado no GitHub · fonte única · não executa comandos.</footer>
    </section>
  );
}
