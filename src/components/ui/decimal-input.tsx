import * as React from "react";

import { Input } from "@/components/ui/input";
import { parseDecimalInput, type DecimalInputLocale } from "@/lib/decimal";

export interface DecimalInputProps
  extends Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
  /** Called on blur with the parsed value (or null if invalid) */
  onValueCommit?: (parsed: { normalized: string; number: number } | null) => void;
  min?: number;
  maxDecimals?: number;
  allowNegative?: boolean;
  locale?: DecimalInputLocale;
}

export function DecimalInput({
  value,
  onValueChange,
  onValueCommit,
  min,
  maxDecimals = 10,
  allowNegative = false,
  locale = 'auto',
  inputMode = "decimal",
  ...props
}: DecimalInputProps) {
  return (
    <Input
      {...props}
      type="text"
      inputMode={inputMode}
      autoComplete={props.autoComplete ?? "off"}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      onBlur={(e) => {
        props.onBlur?.(e);
        const parsed = parseDecimalInput(value, { min, maxDecimals, allowNegative, locale });
        if (parsed) {
          // Canonicalize to normalized representation so DB receives the exact value.
          onValueChange(parsed.normalized);
        }
        onValueCommit?.(parsed);
      }}
    />
  );
}
