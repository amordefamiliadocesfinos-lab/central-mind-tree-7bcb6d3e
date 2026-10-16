import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Zap } from 'lucide-react';
import { QuickConversationDialog } from './QuickConversationDialog';
import { cn } from '@/lib/utils';

const ALLOWED_PREFIXES = ['/contatos', '/crm', '/digital', '/rotas', '/atendimento'];
const POSITION_KEY = 'pc.quickconv.fab.position';
const FAB_SIZE = 48;
const DRAG_THRESHOLD = 4;

function getDefaultPosition() {
  if (typeof window === 'undefined') return { x: 0, y: 0 };
  const margin = 12;
  return {
    x: Math.max(margin, window.innerWidth - FAB_SIZE - margin),
    y: Math.max(margin, Math.round(window.innerHeight / 2 - FAB_SIZE / 2)),
  };
}

export function QuickConversationFAB() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  // UX02: a Inbox não oferece mais este registro legado. Outros módulos continuam intactos.
  const isInbox = location.pathname === '/contatos/inbox' || location.pathname.startsWith('/contatos/inbox/');
  const isAllowed = !isInbox && ALLOWED_PREFIXES.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (isInbox) setOpen(false);
  }, [isInbox]);

  const [position, setPosition] = useState(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    const margin = 12;
    const maxX = Math.max(margin, window.innerWidth - FAB_SIZE - margin);
    const maxY = Math.max(margin, window.innerHeight - FAB_SIZE - margin);
    try {
      const saved = localStorage.getItem(POSITION_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        return {
          x: Math.min(Math.max(margin, p.x ?? maxX), maxX),
          y: Math.min(Math.max(margin, p.y ?? maxY / 2), maxY),
        };
      }
    } catch {}
    return getDefaultPosition();
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const movedRef = useRef(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isInbox && (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isInbox]);

  useEffect(() => {
    const handleResize = () => {
      const margin = 12;
      const maxX = Math.max(margin, window.innerWidth - FAB_SIZE - margin);
      const maxY = Math.max(margin, window.innerHeight - FAB_SIZE - margin);
      setPosition((prev) => ({
        x: Math.min(Math.max(margin, prev.x), maxX),
        y: Math.min(Math.max(margin, prev.y), maxY),
      }));
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragOffset.current = { x: clientX - position.x, y: clientY - position.y };
    dragStart.current = { x: clientX, y: clientY };
    movedRef.current = false;
    setIsDragging(true);
  }, [position.x, position.y]);

  useEffect(() => {
    if (!isDragging) return;
    const margin = 12;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      if (Math.abs(clientX - dragStart.current.x) > DRAG_THRESHOLD ||
          Math.abs(clientY - dragStart.current.y) > DRAG_THRESHOLD) {
        movedRef.current = true;
      }
      if ('touches' in e) e.preventDefault();
      const maxX = Math.max(margin, window.innerWidth - FAB_SIZE - margin);
      const maxY = Math.max(margin, window.innerHeight - FAB_SIZE - margin);
      setPosition({
        x: Math.min(Math.max(margin, clientX - dragOffset.current.x), maxX),
        y: Math.min(Math.max(margin, clientY - dragOffset.current.y), maxY),
      });
    };
    const handleEnd = () => {
      setIsDragging(false);
      setPosition((p) => {
        try { localStorage.setItem(POSITION_KEY, JSON.stringify(p)); } catch {}
        return p;
      });
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  if (!isAllowed) return null;

  const handleClick = () => {
    if (movedRef.current) return;
    setOpen(true);
  };

  return (
    <>
      <div
        className="fixed z-40 touch-none"
        style={{ left: position.x, top: position.y }}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              onClick={handleClick}
              className={cn(
                'rounded-full shadow-lg h-12 w-12 bg-primary hover:bg-primary/90',
                'transition-transform',
                isDragging ? 'scale-110 cursor-grabbing' : 'cursor-grab hover:scale-105',
              )}
              aria-label="Registrar conversa (arraste para mover)"
            >
              <Zap className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            Registrar conversa <span className="ml-2 text-[10px] opacity-60">⌘⇧W</span>
          </TooltipContent>
        </Tooltip>
      </div>
      <QuickConversationDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
