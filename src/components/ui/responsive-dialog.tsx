import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerClose,
} from "@/components/ui/drawer";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  /**
   * Optional sticky footer node (e.g. action buttons). On mobile renders as a
   * fixed bottom bar with safe-area padding. On desktop renders below content.
   */
  footer?: React.ReactNode;
  /** Keeps header and footer visible while the dialog body scrolls. */
  scrollable?: boolean;
}

export function ResponsiveDialog({
  open,
  onOpenChange,
  children,
  title,
  description,
  className,
  footer,
  scrollable = false,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className={cn(
            "max-h-[96vh] flex flex-col p-0",
            className
          )}
        >
          {/* Sticky header */}
          {(title || description) && (
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-background/95 backdrop-blur px-4 py-3 safe-area-pt">
              <div className="flex-1 min-w-0">
                {title && (
                  <h2 className="text-base font-semibold leading-tight">
                    {title}
                  </h2>
                )}
                {description && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {description}
                  </p>
                )}
              </div>
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 -mr-2 shrink-0"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </Button>
              </DrawerClose>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
          {footer && (
            <div className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur px-4 py-3 pb-safe-bottom">
              {footer}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "sm:max-w-lg",
        scrollable && "flex max-h-[92vh] flex-col",
        className,
      )}>
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        {scrollable ? (
          <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6">{children}</div>
        ) : children}
        {footer && <div className={cn("border-t", scrollable ? "mt-2 shrink-0 pt-3" : "mt-3 pt-3")}>{footer}</div>}
      </DialogContent>
    </Dialog>
  );
}

// Full-screen dialog for mobile
interface FullScreenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  footer?: React.ReactNode;
  /** Optional actions in the header (e.g. Save button) */
  headerActions?: React.ReactNode;
}

export function FullScreenDialog({
  open,
  onOpenChange,
  children,
  title,
  description,
  className,
  footer,
  headerActions,
}: FullScreenDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className={cn(
            "h-[100dvh] max-h-[100dvh] rounded-none flex flex-col p-0",
            className
          )}
        >
          {/* Sticky mobile header with safe area */}
          <div className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/95 backdrop-blur px-3 py-2 safe-area-pt">
            <DrawerClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </Button>
            </DrawerClose>
            <div className="flex-1 min-w-0">
              {title && (
                <h2 className="text-base font-semibold leading-tight truncate">
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-[11px] text-muted-foreground truncate">
                  {description}
                </p>
              )}
            </div>
            {headerActions && (
              <div className="flex items-center gap-1 shrink-0">{headerActions}</div>
            )}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">{children}</div>

          {/* Sticky footer */}
          {footer && (
            <div className="sticky bottom-0 z-20 border-t bg-background/95 backdrop-blur px-4 py-3 pb-safe-bottom">
              {footer}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("sm:max-w-2xl max-h-[85vh] flex flex-col", className)}
      >
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        <div className="flex-1 overflow-y-auto -mx-6 px-6">{children}</div>
        {footer && <div className="pt-3 border-t mt-2">{footer}</div>}
      </DialogContent>
    </Dialog>
  );
}
