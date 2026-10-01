import { useEffect, useState } from "react";

type LegacyApp = typeof import("../App").default;

export function LegacySpaBoundary() {
  const [LegacyApp, setLegacyApp] = useState<LegacyApp | null>(null);

  useEffect(() => {
    let active = true;

    void import("../App").then(({ default: App }) => {
      if (active) {
        setLegacyApp(() => App);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return LegacyApp ? <LegacyApp /> : <div aria-live="polite">Carregando Painel Central…</div>;
}
