import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Search, FileText, Box, X, GripVertical, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { getCrmRouteBlockReason } from "@/lib/crm/crmRouteNavigationGuards";

interface NodeItem {
  id: string;
  title: string;
  parent_id: string | null;
  is_visible: boolean;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  node_id: string;
}

interface SearchResult {
  type: "node" | "task";
  id: string;
  title: string;
  parentTitle?: string;
  nodeId?: string;
  isHidden?: boolean;
}

interface GlobalSearchBarProps {
  onNodeSelect?: (nodeId: string) => void;
}

function normalizeStr(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function tokenize(str: string): string[] {
  return normalizeStr(str).split(/\s+/).filter(Boolean);
}

function matchesQuery(queryTokens: string[], ...fields: (string | null)[]): boolean {
  const combined = fields.filter(Boolean).join(" ");
  const normalized = normalizeStr(combined);
  return queryTokens.every((token) => normalized.includes(token));
}

const POSITION_KEY = "pc.searchbar.position";

export function GlobalSearchBar({ onNodeSelect }: GlobalSearchBarProps) {
  const isMobile = useIsMobile();
  const [query, setQuery] = useState("");
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showNodes, setShowNodes] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [position, setPosition] = useState(() => {
    const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
    const collapsedWidth = isMobileViewport ? 140 : 160;
    const margin = 8;
    const maxX = Math.max(margin, window.innerWidth - collapsedWidth - margin);
    const defaultX = maxX;
    const saved = localStorage.getItem(POSITION_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const maxY = Math.max(0, window.innerHeight - 60);
        return {
          x: Math.min(Math.max(margin, parsed.x ?? defaultX), maxX),
          y: Math.min(Math.max(0, parsed.y ?? 12), maxY),
        };
      } catch {
        return { x: defaultX, y: 12 };
      }
    }
    return { x: defaultX, y: 12 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const [nodesRes, tasksRes] = await Promise.all([
        supabase.from("nodes").select("id, title, parent_id, is_visible"),
        supabase.from("tasks").select("id, title, description, node_id"),
      ]);
      if (nodesRes.data) setNodes(nodesRes.data);
      if (tasksRes.data) setTasks(tasksRes.data);
    };
    fetchData();

    const nodesChannel = supabase
      .channel("global-search-nodes")
      .on("postgres_changes", { event: "*", schema: "public", table: "nodes" }, fetchData)
      .subscribe();

    const tasksChannel = supabase
      .channel("global-search-tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(nodesChannel);
      supabase.removeChannel(tasksChannel);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault();
          inputRef.current?.focus();
          setIsOpen(true);
        }
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        setQuery("");
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsFocused(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Reclamp position on viewport resize/rotation so the bar never sits off-screen
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const isMobileViewport = window.innerWidth < 768;
        const collapsedWidth = isMobileViewport ? 140 : 160;
        const margin = 8;
        const maxX = Math.max(margin, window.innerWidth - collapsedWidth - margin);
        const maxY = Math.max(0, window.innerHeight - 60);
        return {
          x: Math.min(Math.max(margin, prev.x), maxX),
          y: Math.min(Math.max(0, prev.y), maxY),
        };
      });
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      setDragOffset({ x: clientX - rect.left, y: clientY - rect.top });
      setIsDragging(true);
    }
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const newX = Math.max(0, Math.min(window.innerWidth - 160, clientX - dragOffset.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 50, clientY - dragOffset.y));
      setPosition({ x: newX, y: newY });
    };

    const handleEnd = () => {
      setIsDragging(false);
      localStorage.setItem(POSITION_KEY, JSON.stringify(position));
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleMove, { passive: false });
    document.addEventListener("touchend", handleEnd);

    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging, dragOffset, position]);

  const nodeTitleMap = useMemo(() => {
    const map: Record<string, string> = {};
    nodes.forEach((n) => (map[n.id] = n.title));
    return map;
  }, [nodes]);

  const visibleNodeIds = useMemo(() => {
    return new Set(nodes.filter((n) => n.is_visible).map((n) => n.id));
  }, [nodes]);

  const results = useMemo<SearchResult[]>(() => {
    if (query.length < 2) return [];
    const queryTokens = tokenize(query);
    const out: SearchResult[] = [];

    if (showNodes) {
      nodes.forEach((node) => {
        if ((node.is_visible || showHidden) && matchesQuery(queryTokens, node.title)) {
          const parentTitle = node.parent_id ? nodeTitleMap[node.parent_id] : undefined;
          out.push({ 
            type: "node", 
            id: node.id, 
            title: node.title, 
            parentTitle,
            isHidden: !node.is_visible,
          });
        }
      });
    }

    if (showTasks) {
      tasks.forEach((task) => {
        const nodeIsVisible = visibleNodeIds.has(task.node_id);
        if ((nodeIsVisible || showHidden) && matchesQuery(queryTokens, task.title, task.description)) {
          out.push({
            type: "task",
            id: task.id,
            title: task.title,
            parentTitle: nodeTitleMap[task.node_id],
            nodeId: task.node_id,
            isHidden: !nodeIsVisible,
          });
        }
      });
    }

    return out.slice(0, 20);
  }, [query, nodes, tasks, nodeTitleMap, showNodes, showTasks, visibleNodeIds, showHidden]);

  const handleResultClick = useCallback(
    async (result: SearchResult) => {
      // A pesquisa global usa navigate() imperativo: não passa por <a href>.
      const reason = getCrmRouteBlockReason();
      if (reason) { toast.warning(reason); return; }
      setQuery("");
      setIsOpen(false);

      const nodeIdToNavigate = result.type === "node" ? result.id : result.nodeId;

      if (result.isHidden && nodeIdToNavigate) {
        const ancestorIds: string[] = [];
        let currentId: string | null = nodeIdToNavigate;
        
        while (currentId) {
          ancestorIds.push(currentId);
          const node = nodes.find(n => n.id === currentId);
          currentId = node?.parent_id || null;
        }

        if (ancestorIds.length > 0) {
          await supabase
            .from("nodes")
            .update({ is_visible: true })
            .in("id", ancestorIds);
          
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (result.type === "node") {
        if (onNodeSelect) {
          onNodeSelect(result.id);
        } else {
          navigate(`/?highlight=${result.id}`);
        }
      } else if (result.type === "task") {
        if (nodeIdToNavigate) {
          navigate(`/?highlight=${nodeIdToNavigate}&openTasks=true&taskId=${result.id}`);
        }
      }
    },
    [onNodeSelect, navigate, nodes]
  );

  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
  const collapsedWidth = isMobileViewport ? 140 : 160;
  const expandedWidth = isMobileViewport ? Math.min(window.innerWidth - 24, 320) : 320;

  // Hide on mobile to avoid overlapping page headers; mobile users have bottom nav + per-page search
  if (isMobile) return null;

  return (
    <div
      ref={containerRef}
      style={{
        left: position.x,
        top: position.y,
        width: isFocused ? expandedWidth : collapsedWidth,
        maxWidth: 'calc(100vw - 16px)',
      }}
      className={`fixed z-50 transition-[width] duration-200 ${isDragging ? 'cursor-grabbing' : ''}`}
    >
      <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg">
        <div className="relative p-2 flex items-center gap-1">
          <div
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none select-none"
            title="Arrastar"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value.length >= 2) setIsOpen(true);
              }}
              onFocus={() => {
                setIsFocused(true);
                if (query.length >= 2) setIsOpen(true);
              }}
              onBlur={() => {
                if (!query) setIsFocused(false);
              }}
              placeholder="Pesquisar..."
              className="pl-7 pr-7 h-8 text-sm"
            />
            {!isFocused && !query && (
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border">
                /
              </kbd>
            )}
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setIsOpen(false);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {isOpen && query.length >= 2 && (
          <div className="border-t max-h-64 overflow-y-auto">
            <div className="flex flex-wrap gap-3 p-2 border-b text-sm">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showNodes}
                  onChange={(e) => setShowNodes(e.target.checked)}
                  className="rounded"
                />
                <Box className="h-3 w-3" />
                Nós
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showTasks}
                  onChange={(e) => setShowTasks(e.target.checked)}
                  className="rounded"
                />
                <FileText className="h-3 w-3" />
                Tarefas
              </label>
              <label className="flex items-center gap-1 cursor-pointer text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showHidden}
                  onChange={(e) => setShowHidden(e.target.checked)}
                  className="rounded"
                />
                <EyeOff className="h-3 w-3" />
                Ocultos
              </label>
            </div>

            {results.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">Nenhum resultado</div>
            ) : (
              <div className="py-1">
                {results.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleResultClick(result)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent text-left transition-colors"
                  >
                    {result.type === "node" ? (
                      <Box className={`h-4 w-4 shrink-0 ${result.isHidden ? 'text-muted-foreground/50' : 'text-primary'}`} />
                    ) : (
                      <FileText className={`h-4 w-4 shrink-0 ${result.isHidden ? 'text-muted-foreground/50' : 'text-muted-foreground'}`} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className={`font-medium truncate flex items-center gap-1 ${result.isHidden ? 'text-muted-foreground' : ''}`}>
                        {result.title}
                        {result.isHidden && <EyeOff className="h-3 w-3 text-muted-foreground/60" />}
                      </div>
                      {result.parentTitle && (
                        <div className="text-xs text-muted-foreground truncate">{result.parentTitle}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
