import { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type FoundationPageProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

export function FoundationPage({ title, description, children }: FoundationPageProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Fundação M0
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Esta tela usa somente conteúdo estrutural. Dados reais de saúde permanecem bloqueados
            até a aprovação de identidade, RLS, Storage privado e pipeline de migrations.
          </p>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}
