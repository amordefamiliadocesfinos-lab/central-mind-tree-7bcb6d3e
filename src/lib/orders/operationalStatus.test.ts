import { isSeparationEligible } from './operationalStatus';

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

expect(
  !isSeparationEligible({ operational_status: 'cancelled', status: 'pendente' }),
  'Cancelamento operacional não pode aparecer na Separação.',
);
expect(
  !isSeparationEligible({ status: 'cancelado' }),
  'Cancelamento legado continua protegido durante a compatibilidade.',
);
expect(
  isSeparationEligible({ operational_status: 'finalized', status: 'concluido' }),
  'Finalizado permanece visível no histórico da Separação.',
);
