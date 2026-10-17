import type { StartOpportunityCandidate } from './startOpportunityCandidates';

/** C2-04: um erro/dado insuficiente nunca pode parecer ausência comprovada. */
export type StartOpportunityDisplayState =
  | 'loading' | 'recommended' | 'error' | 'insufficient' | 'blocked' | 'no_signal' | 'empty';

export interface StartOpportunityPresentationInput {
  isLoading: boolean;
  analyzedCount: number;
  hasRecommendation: boolean;
  hasMore: boolean;
  error: string | null;
  candidates: readonly Pick<StartOpportunityCandidate, 'state'>[];
}

export function resolveStartOpportunityDisplayState(input: StartOpportunityPresentationInput): StartOpportunityDisplayState {
  if (input.isLoading && input.analyzedCount === 0) return 'loading';
  if (input.hasRecommendation) return 'recommended';
  if (input.error || input.candidates.some(c => c.state === 'error')) return 'error';
  if (input.candidates.some(c => c.state === 'insufficient')) return 'insufficient';
  if (input.candidates.some(c => c.state === 'blocked')) return 'blocked';
  if (input.analyzedCount === 0 && !input.hasMore) return 'empty';
  return 'no_signal';
}
