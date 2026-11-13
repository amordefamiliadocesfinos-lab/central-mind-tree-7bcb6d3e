import { Link, useLocation } from "react-router-dom";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function CapturaCentralFAB() {
  const location = useLocation();
  const isActive = location.pathname === "/captura";

  return (
    <Link
      data-captura-fab="true"
      to="/captura"
      aria-label="Abrir Captura Central"
      title="Captura Central"
      className={cn(
        "fixed z-40 left-3 bottom-16 md:left-4 md:bottom-20",
        "h-12 w-12 rounded-full flex items-center justify-center",
        "bg-primary text-primary-foreground shadow-lg shadow-primary/30",
        "hover:scale-105 active:scale-95 transition-transform",
        "ring-2 ring-background",
        isActive && "ring-primary/40",
      )}
    >
      <Inbox className="h-5 w-5" />
      <span className="sr-only">Captura Central</span>
    </Link>
  );
}
