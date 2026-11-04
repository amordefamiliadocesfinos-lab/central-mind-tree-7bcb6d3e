import {r2SealedPackageBlocker} from './shopee-rodada2-sealed-1kg-guard.mjs';
import {R1_EMB2_LEITE_KEY,R1_EMB1_MIX_KEY,r1EmballagePhysicalBlocker} from './shopee-rodada1-v16-leite-mix-guard.mjs';
import { r1V16UnresolvedBlocker } from './shopee-rodada1-v16-unresolved-guard.mjs';
import { EMB2_MODELS, emb2PhysicalBlocker } from './shopee-rodada1-v16-emb2-guard.mjs';
import { R1_V16_PROTECTED_MODELS, rodada1V16PhysicalBlocker } from './shopee-rodada1-v16-physical-guard.mjs';
import { MALTO_ADAO_MODELS, maltoAdaoPhysicalBlocker } from './shopee-maltodextrina-adao-v14-guard.mjs';
import { GLUCODRY_ADAO_MODELS, glucodryAdaoPhysicalBlocker } from './shopee-glucodry-adao-v13-guard.mjs';
import { DU_PORTO_ADAO_V12_MODELS } from './shopee-po-sorvete-adao-v12-contract.mjs';
import { duPortoPhysicalBlocker } from './shopee-po-sorvete-adao-v12-guard.mjs';
const MASS_IN_GRAMS = { g: 1, kg: 1000, mg: 0.001 };

// Accept only one explicit mass. Ranges/multiple sizes are deliberately not
// guessed. A model's explicit size takes precedence over the generic title.
function explicitMass(text) {
  const matches = [...String(text ?? '').toLowerCase().matchAll(/\b(\d+(?:[.,]\d+)?)\s*(kg|mg|g)\b/g)];
  if (matches.length !== 1) return null;
  // "1 a 4 kg" / "1-4kg" do not describe a single sold presentation.
  if (/\d\s*(?:a|até|ate|[-–/|])\s*\d+(?:[.,]\d+)?\s*(?:kg|mg|g)\b/i.test(String(text))) return null;
  if (/\b\d+\s*[x×]|\b(?:kit|caixa|pacote)s?\s*(?:com|de)?\s*\d|\b\d+\s*(?:pacotes|sacos|unidades)\b/i.test(String(text))) return null;
  const m = matches[0];
  return Number(m[1].replace(',', '.')) * MASS_IN_GRAMS[m[2]];
}

// Original sealed packages are counted per package, never as loose grams/units.
const SEALED = Object.freeze({
 '58253351845|179728184791':['c4580ad6-e53a-4a36-9696-a65f2a95da00','e25d7363-8c77-4cce-878d-af23fef3c333','cx'],
 '58253351845|179728184792':['c4580ad6-e53a-4a36-9696-a65f2a95da00','a36f690f-39db-4ecd-a8f7-1cc27a266a44','cx'],
 '23899479158|209190157982':['c70dd4b4-bc59-4d88-81ef-1a8c47315560','1a3d59a6-4712-4afd-811a-5a72aad76fa9','g'],
 '23899479158|209190157983':['c70dd4b4-bc59-4d88-81ef-1a8c47315560','f6588f52-6e28-4ce9-b492-a95c847d5c0c','g'],
});
// Shopee Adão: physical contracts for the six published roasted-peanut models.
// AM3 is one sealed E24 sack; its presentation routes the physical stock event.
const AMENDOIM_ADAO_MODELS = Object.freeze({
  '22894540357|159549469456': 350,
  '22894540357|159549469457': 1000,
  '22894540357|159549469458': 2000,
  '22894540357|239443947635': 3000,
  '23899023961|149554596204': 1000,
  '58211774121|199622620371': 1,
});
const AMENDOIM_ADAO_ACCOUNT_ID = 'b4027369-5abf-4ac1-ab24-862334fae892';
const AMENDOIM_PRODUCT_ID = 'c177f332-a1c7-4276-9cef-7b81af920174';

function amendoimPhysicalBlocker(item, components, scope) {
  if (components.length !== 1) return 'amendoim_composition_invalid';
  const key = String(item?.itemId) + '|' + String(item?.modelId);
  const c = components[0];
  const identity = c.physical_identity;
  if (scope?.channelAccountId !== AMENDOIM_ADAO_ACCOUNT_ID) return 'amendoim_account_unverified';
  if (c.product_id !== AMENDOIM_PRODUCT_ID || c.variant_id != null
    || identity?.active !== true || identity?.unit !== 'g'
    || Number(c.physical_multiplier) !== AMENDOIM_ADAO_MODELS[key]) {
    return 'amendoim_physical_identity_unverified';
  }
  return null;
}

// Chocoim 34g / Shopee Adão V11. Exact official identities only.
// CH3 is forty finished units per commercial base; Q is applied downstream.
const CHOCOIM_ADAO_ACCOUNT_ID = 'b4027369-5abf-4ac1-ab24-862334fae892';
const CHOCOIM_PRODUCT_ID = 'e01a87f3-615d-4330-87c6-d0f9878a7c3b';
const CHOCOIM_VARIANTS = Object.freeze({
  MA: '3e67edc6-1cb7-463e-8c8e-a50bfb5092f7',
  BR: '66708945-22f3-43bf-b68e-127021448cd8',
  MS: '1a84c7f3-4130-45fc-920f-62aecafe4c91',
});
const CHOCOIM_ADAO_MODELS = Object.freeze({
  '58211753487|189196513020': [8, 'MA'],
  '58211753487|189196513021': [8, 'BR'],
  '58211753487|189196513022': [8, 'MS'],
  '58211756648|169421459623': [20, 'MA'],
  '58211756648|169421459624': [20, 'BR'],
  '58211756648|169421459618': [20, 'MS'],
  '58211756648|169421459619': [40, 'MA'],
  '58211756648|169421459620': [40, 'BR'],
  '58211756648|169421459621': [40, 'MS'],
  '58211756648|169421459622': [80, 'MA'],
  '58211756648|169421459616': [80, 'BR'],
  '58211756648|169421459617': [80, 'MS'],
  '23199886586|149558245644': [40, 'MA'],
  '23199886586|149558245645': [40, 'BR'],
  '23199886586|149558245646': [40, 'MS'],
});
function chocoimPhysicalBlocker(item, components, scope, contract) {
  if (scope?.channelAccountId !== CHOCOIM_ADAO_ACCOUNT_ID) return 'chocoim_account_unverified';
  if (components.length !== 1) return 'chocoim_composition_invalid';
  const component = components[0];
  const identity = component.physical_identity;
  if (component.product_id !== CHOCOIM_PRODUCT_ID
    || component.variant_id !== CHOCOIM_VARIANTS[contract[1]]
    || identity?.active !== true || identity?.unit !== 'un'
    || Number(component.physical_multiplier) !== contract[0]) {
    return 'chocoim_physical_identity_unverified';
  }
  return null;
}

export function mappingPhysicalBlocker(item, mapping, scope = {}) {
  const components = mapping.components?.length ? mapping.components : [mapping];
  const amendoimKey = String(item?.itemId) + '|' + String(item?.modelId);
  if (Object.hasOwn(AMENDOIM_ADAO_MODELS, amendoimKey)) {
    return amendoimPhysicalBlocker(item, components, scope);
  }
  if (Object.hasOwn(CHOCOIM_ADAO_MODELS, amendoimKey)) {
    return chocoimPhysicalBlocker(item, components, scope, CHOCOIM_ADAO_MODELS[amendoimKey]);
  }
  if (Object.hasOwn(DU_PORTO_ADAO_V12_MODELS, amendoimKey)) return duPortoPhysicalBlocker(item, components, scope, DU_PORTO_ADAO_V12_MODELS[amendoimKey]);
  if (Object.hasOwn(GLUCODRY_ADAO_MODELS, amendoimKey)) {
    return glucodryAdaoPhysicalBlocker(item, components, scope, GLUCODRY_ADAO_MODELS[amendoimKey]);
  }
  if (Object.hasOwn(MALTO_ADAO_MODELS, amendoimKey)) {
    return maltoAdaoPhysicalBlocker(item, components, scope, MALTO_ADAO_MODELS[amendoimKey]);
  }
  if (Object.hasOwn(R1_V16_PROTECTED_MODELS, amendoimKey)) {
    return rodada1V16PhysicalBlocker(item, components, scope, R1_V16_PROTECTED_MODELS[amendoimKey]);
  }
  if (Object.hasOwn(EMB2_MODELS,amendoimKey)) {
    return emb2PhysicalBlocker(item,components,scope,EMB2_MODELS[amendoimKey]);
  }
  if(amendoimKey===R1_EMB2_LEITE_KEY || amendoimKey===R1_EMB1_MIX_KEY)
    return r1EmballagePhysicalBlocker(item,components,scope);
  const r2SealedBlock=r2SealedPackageBlocker(item,scope);
  if(r2SealedBlock)return r2SealedBlock;
  const unresolved = r1V16UnresolvedBlocker(item,scope);
  if (unresolved) return unresolved;
  const sealed = SEALED[String(item?.itemId)+'|'+String(item?.modelId)];
  if (sealed) {
    if (components.length !== 1) return 'sealed_composition_invalid';
    const c=components[0], identity=c.physical_identity;
    if (c.product_id!==sealed[0] || c.variant_id!==sealed[1]
      || identity?.active!==true || identity?.unit!==sealed[2]
      || Number(c.physical_multiplier)!==1) return 'sealed_physical_identity_unverified';
    return null;
  }
  for (const c of components) {
    const identity = c.physical_identity;
    if (!identity || identity.active !== true || !identity.unit) return 'physical_identity_unverified';
    const multiplier = Number(c.physical_multiplier);
    const quantity = Number(item.quantity) * multiplier;
    if (!Number.isFinite(multiplier) || multiplier <= 0 || !Number.isSafeInteger(quantity) || quantity <= 0
      || quantity > 2147483647) return 'physical_quantity_invalid';
    const scale = MASS_IN_GRAMS[String(identity.unit).trim().toLowerCase()];
    if (!scale && String(identity.unit).trim().toLowerCase() !== 'un') return 'physical_unit_requires_review';
    if (scale) {
      // Weighted compositions need explicit commercial composition evidence;
      // this guard does not infer a kit's physical split from its title.
      if (components.length !== 1) return 'physical_composition_requires_review';
      const modelHasMass = /\b\d+(?:[.,]\d+)?\s*(?:kg|mg|g)\b/i.test(String(item.modelName ?? ''));
      const grams = explicitMass(modelHasMass ? item.modelName : item.itemName);
      if (grams === null || grams <= 0) return 'sold_mass_unverified';
      if (Math.abs(multiplier * scale - grams) > 0.000001) return 'physical_multiplier_mismatch';
      if (!identity.presentation_factors?.some(f => Number.isFinite(Number(f)) && Number(f) > 0
        && Number.isSafeInteger(multiplier / Number(f)) && multiplier / Number(f) >= 1)) return 'physical_presentation_unverified';
    }
  }
  return null;
}
