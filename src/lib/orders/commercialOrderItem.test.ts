import { describe, it, expect } from 'vitest';
import { expandCommercialOrderItem, getOrderItemLineTotal } from './commercialOrderItem';
import type { CommercialPresentation } from '../products/commercialPresentation';

const product = { id: 'alfajor', unit: 'un' };
function mixed(white: number, black: number): CommercialPresentation {
 return {
   id: 'mix', product_id: 'alfajor', variant_id: null,
   name: 'Bandeja 18', commercial_unit_label: 'bandeja',
   conversion_factor: 18, composition_mode: 'composite', is_active: true,
   notes: null, created_at: '', updated_at: '',
   components: [
      { product_id: 'alfajor', variant_id: 'branco', quantity: white },
      { product_id: 'alfajor', variant_id: 'preto', quantity: black }
   ],
 };
}
describe('presentations with canonical physical composition', () => {
 it.each([[9,9],[6,12]])('expands %i Branco + %i Preto without losing commercial value', (white,black) => {
   const result = expandCommercialOrderItem(product,null,2,35.01,mixed(white,black));
   expect(result.map(line => line.quantity)).toEqual([white*2,black*2]);
   expect(result.map(line => line.variant_id)).toEqual(['branco','preto']);
   const cents = Math.round(result.reduce((sum,item) => sum+getOrderItemLineTotal(item),0)*100);
   expect(cents).toBe(7002);
   expect(result.every(line => line.commercial_presentation_name === 'Bandeja 18')).toBe(true);
 });
 it('rejects missing canonical components',()=>{
   expect(()=>expandCommercialOrderItem(product,null,1,35.01,{...mixed(9,9),components:[]})).toThrow();
 });
});
