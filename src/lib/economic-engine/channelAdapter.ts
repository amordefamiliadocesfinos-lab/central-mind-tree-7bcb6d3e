import type { EconomicComponent } from './domain';

export type ChannelAdapterKey = 'shopee';

export type ChannelRuleWindow = {
  engineVersion: string;
  ruleVersion: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  sourceRefs: string[];
};

export type ChannelAdapterMeta = {
  adapter: ChannelAdapterKey;
  marketplace: string;
  channelAccountId: string | null;
  offerMappingId: string | null;
  rule: ChannelRuleWindow;
  warnings: string[];
  confidence: 'high' | 'medium' | 'low';
};

export type ChannelAdapterResult<TScenario> = {
  meta: ChannelAdapterMeta;
  components: EconomicComponent[];
  scenario: TScenario;
};
