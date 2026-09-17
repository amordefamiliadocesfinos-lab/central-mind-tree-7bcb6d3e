import * as React from 'react';

import { Input } from '@/components/ui/input';
import { formatBrazilianCurrencyInput, parseBrazilianCurrencyInput } from '@/lib/currencyInput';
import type { ParsedDecimal } from '@/lib/decimal';

export interface CurrencyInputProps
  extends Omit<React.ComponentProps<typeof Input>, 'type' | 'value' | 'onChange'> {
  value: string;
  onValueChange: (value: string) => void;
  onValueCommit?: (parsed: ParsedDecimal | null) => void;
}

/**
 * Mantém o texto totalmente livre durante a digitação e só formata em pt-BR
 * ao perder foco. Assim vírgula, milhar, apagar tudo e substituir o valor não
 * movem o cursor nem restauram o preço de catálogo prematuramente.
 */
export function CurrencyInput({ value, onValueChange, onValueCommit, onFocus, onBlur, inputMode = 'decimal', ...props }: CurrencyInputProps) {
  return (
    <Input
      {...props}
      type="text"
      inputMode={inputMode}
      autoComplete={props.autoComplete ?? 'off'}
      value={value}
      onFocus={(event) => {
        onFocus?.(event);
        // Valores já formatados vêm do cadastro. Selecioná-los facilita a
        // substituição direta, sem impedir que o usuário navegue no texto.
        if (value.startsWith('R$')) event.currentTarget.select();
      }}
      onChange={(event) => onValueChange(event.target.value)}
      onBlur={(event) => {
        onBlur?.(event);
        const parsed = parseBrazilianCurrencyInput(value);
        if (parsed) onValueChange(formatBrazilianCurrencyInput(parsed.number));
        onValueCommit?.(parsed);
      }}
    />
  );
}
