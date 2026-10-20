import { getCrmStartRecommendationCardClass, getCrmStartSectionCardClass, type CrmStartSection } from './startOpportunityVisualHierarchy';
import type { StartOpportunityDisplayState } from './startOpportunityPresentation';
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw Error('UX-CRM-03C: ' + message); }
assert(getCrmStartRecommendationCardClass('recommended').includes('violet'), 'recomendação comprovada em violeta');
assert(getCrmStartRecommendationCardClass('blocked').includes('amber'), 'impedimento não parece oportunidade');
assert(getCrmStartRecommendationCardClass('error').includes('red'), 'erro em tom de falha');
for (const state of ['loading','insufficient','no_signal','empty'] as StartOpportunityDisplayState[]) {
  assert(getCrmStartRecommendationCardClass(state).includes('slate'), 'sem comprovação não anuncia recomendação: '+state);
}
const sections: CrmStartSection[] = ['post_sale','repurchase','campaigns'];
const styles = sections.map(getCrmStartSectionCardClass);
assert(new Set(styles).size === 3, 'identidade distinta para cada seção');
for (const style of styles) assert(style.includes('border-t-') && style.includes('dark:'), 'alto contraste no tema claro/escuro');
console.log('startOpportunityVisualHierarchy.test: OK');
