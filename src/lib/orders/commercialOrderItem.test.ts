import test from 'node:test';
import assert from 'node:assert/strict';
import { expandCommercialOrderItem, getOrderItemLineTotal, isSaleVariantAllowed, GLUCODRY_PRODUCT_ID, GLUCODRY_GD2_PRESENTATION_ID, CHOCOLATE_BASE_PRODUCT_ID, CHOCOLATE_CB3_BRANCO_ID, CHOCOLATE_CB3_MEIO_AMARGO_ID, isChocolateCB3, getDefaultCommercialUnitPrice } from './commercialOrderItem';
import type { CommercialPresentation } from '../products/commercialPresentation';
const a={id:'a',unit:'un',variation_mode:'variacoes_fisicas',is_active:true};
const t30={id:'t30',unit:'un',variation_mode:'variacoes_fisicas',is_active:true};
const t40={id:'t40',unit:'un',variation_mode:'variacoes_fisicas',is_active:true};
const variants=[{id:'branco',product_id:'a',unit:'un',is_active:true},{id:'amargo',product_id:'a',unit:'un',is_active:true},...['brg','mor','mar','bei','lep'].map(id=>({id,product_id:'t30',unit:'un',is_active:true})),{id:'amd',product_id:'t40',unit:'un',is_active:true}];
const catalog={products:[a,t30,t40],variants};
const make=(pid:string,total:number,components:{product_id:string;variant_id:string;quantity:number}[]):CommercialPresentation=>({id:'kit',product_id:pid,variant_id:null,name:'Kit',commercial_unit_label:'kit',composition_mode:'composite',components,conversion_factor:total,is_active:true,notes:null,created_at:'',updated_at:''});
const alf=make('a',36,[{product_id:'a',variant_id:'branco',quantity:18},{product_id:'a',variant_id:'amargo',quantity:18}]);
const mix=make('t30',30,[...['brg','mor','mar','bei','lep'].map(variant_id=>({product_id:'t30',variant_id,quantity:5})),{product_id:'t40',variant_id:'amd',quantity:5}]);
const expand=(product:typeof a,qty:number,price:number,p:CommercialPresentation)=>expandCommercialOrderItem(product,null,qty,price,p,undefined,catalog);
test('Alfajor 36 misto: 1 e 2 apresentações, conservação de centavos',()=>{
 for(const qty of [1,2]){
 const rows=expand(a,qty,19.99,alf);
 assert.deepEqual(rows.map(x=>[x.variant_id,x.quantity]),[['branco',18*qty],['amargo',18*qty]]);
 assert.equal(Math.round(rows.reduce((sum,x)=>sum+getOrderItemLineTotal(x),0)*100),1999*qty);
 }
});
test('Trufa 30 mix inclui Amendoim da Trufa 40, soma 30/60 e conserva centavos',()=>{
 for(const qty of [1,2]){
 const rows=expand(t30,qty,17.17,mix);
 assert.equal(rows.length,6);
 assert.equal(rows.reduce((sum,x)=>sum+x.quantity,0),qty*30);
 assert.deepEqual(rows.find(x=>x.variant_id==='amd')&&[rows.find(x=>x.variant_id==='amd')!.product_id,rows.find(x=>x.variant_id==='amd')!.quantity],['t40',5*qty]);
 assert.equal(Math.round(rows.reduce((sum,x)=>sum+getOrderItemLineTotal(x),0)*100),1717*qty);
 }
});
test('rejeita produto, variante, composição e quantidade inválidos',()=>{
 assert.throws(()=>expand(t30,1,10,make('t30',30,[{product_id:'invalid',variant_id:'amd',quantity:30}])),/inexistente/);
 assert.throws(()=>expand(t30,1,10,make('t30',30,[{product_id:'t30',variant_id:'amd',quantity:30}])),/Variante física/);
 assert.throws(()=>expand(t30,1,10,make('t30',29,[{product_id:'t40',variant_id:'amd',quantity:30}])),/soma física/);
 assert.throws(()=>expand(t30,1,10,make('t30',30,[{product_id:'t40',variant_id:'amd',quantity:15},{product_id:'t40',variant_id:'amd',quantity:15}])),/duplicado/);
 assert.throws(()=>expandCommercialOrderItem(t30,null,1,10,mix),/Catálogo físico/);
 assert.throws(()=>expand(t30,0,10,mix),/Quantidade comercial/);
});
test('Regressão CRM Inbox: múltiplos kits de Trufa e bandejas mistas exigem catálogo físico',()=>{
  // CRM uses the same expansion contract as Operações — real sale has both items.
  const trufas=expand(t30,5,45,mix);
  const bandejas=expand(a,4,32,alf);
  assert.equal(trufas.length,6);
  assert.equal(trufas.reduce((sum,line)=>sum+line.quantity,0),150);
  assert.equal(bandejas.length,2);
  assert.equal(bandejas.reduce((sum,line)=>sum+line.quantity,0),144);
  assert.equal(new Set(trufas.map(line=>line.commercial_group_id)).size,1);
  assert.equal(new Set(bandejas.map(line=>line.commercial_group_id)).size,1);
  assert.equal(Math.round([...trufas,...bandejas].reduce((sum,line)=>sum+getOrderItemLineTotal(line),0)*100),35300);
  assert.throws(()=>expandCommercialOrderItem(t30,null,5,45,mix),/Catálogo físico é obrigatório/);
});

test('somente cálculo: não toca nem muta catálogo físico',()=>{
 const before=JSON.stringify(catalog);expand(t30,2,10,mix);assert.equal(JSON.stringify(catalog),before);
});

test('cada expansão de Mix mantém apresentação original e grupo único compartilhado',()=>{
 const first=expand(t30,2,17.17,mix);
 const second=expand(t30,1,17.17,mix);
 assert.equal(new Set(first.map(x=>x.commercial_presentation_id)).size,1);
 assert.equal(first[0].commercial_presentation_id,'kit');
 assert.equal(new Set(first.map(x=>x.commercial_group_id)).size,1);
 assert.ok(first[0].commercial_group_id);
 assert.notEqual(first[0].commercial_group_id,second[0].commercial_group_id);
 assert.deepEqual(first.map(x=>x.product_id).filter(x=>x==='t40'),['t40']);
 assert.equal(first.reduce((sum,x)=>sum+x.quantity,0),60);
});


test('BA3: caixa original é uma unidade física cx, não 880 biscoitos', () => {
  const biscuit = { id: 'biscuit', unit: 'un', variation_mode: 'variacoes_fisicas', is_active: true };
  const sealedBox = { id: 'biscuit-box-chocolate', product_id: 'biscuit', unit: 'cx', is_active: true };
  const presentation: CommercialPresentation = {
    id: 'ba3', product_id: biscuit.id, variant_id: sealedBox.id,
    name: 'Caixa fechada 8 kg', commercial_unit_label: 'caixa',
    conversion_factor: 1, composition_mode: 'single', is_active: true,
    notes: '8 kg nominais; quantidade interna aproximada', created_at: '', updated_at: '',
  };
  const [item] = expandCommercialOrderItem(biscuit, sealedBox, 2, 270, presentation);
  assert.equal(item.quantity, 2);
  assert.equal(item.physical_unit_label, 'cx');
  assert.equal(item.commercial_quantity, 2);
  assert.equal(item.commercial_unit_label, 'caixa');
  assert.equal(getOrderItemLineTotal(item), 540);
  assert.equal(item.variant_id, sealedBox.id);
  assert.equal(item.commercial_presentation_id, 'ba3');
});

test('BA1: pacote permanece em 22 unidades físicas, sem afetar variante cx', () => {
  const biscuit = { id: 'biscuit', unit: 'un', variation_mode: 'variacoes_fisicas', is_active: true };
  const single = { id: 'biscuit-unit-traditional', product_id: biscuit.id, unit: 'un', is_active: true };
  const presentation: CommercialPresentation = {
    id: 'ba1', product_id: biscuit.id, variant_id: single.id,
    name: 'Pacote 22 un', commercial_unit_label: 'pacote', conversion_factor: 22,
    composition_mode: 'single', is_active: true, notes: null, created_at: '', updated_at: '',
  };
  const [item] = expandCommercialOrderItem(biscuit, single, 16, 7.5, presentation);
  assert.equal(item.quantity, 352);
  assert.equal(item.physical_unit_label, 'un');
  assert.equal(item.variant_id, single.id);
  assert.equal(getOrderItemLineTotal(item), 120);
});

test('Glucose G0 75 kg: fica fora da venda, mantendo outras embalagens disponíveis', () => {
  const glucoseId = '788f7d5a-276c-49c8-8171-cccf7621e2fe';
  const productionVariant = '222c4ec7-45da-4a1c-961e-d61ac2a914d4';
  const sellableVariants = [
    '13ec7121-e3dd-4c4a-84e6-a186d9236647', // 500g
    'ded86020-55b5-4899-a263-1d0dea6b9c88', // 1kg
    'f6783627-bfb6-438e-8663-b37f20697697', // 5kg
    'beb66a4e-ce39-4c8b-b85c-22308f8dc6d2', // 10kg
    '21c194d0-b9af-4d70-b1a0-0d101a4aafbc', // 25kg
  ];
  assert.equal(isSaleVariantAllowed(glucoseId, productionVariant), false);
  for (const id of sellableVariants) {
    assert.equal(isSaleVariantAllowed(glucoseId, id), true);
    const rows = expandCommercialOrderItem(
      { id: glucoseId, unit: 'un', variation_mode: 'variacoes_fisicas', is_active: true },
      { id, product_id: glucoseId, unit: 'un', is_active: true },
      2, 9,
    );
    assert.equal(rows[0].quantity, 2);
    assert.equal(rows[0].variant_id, id);
  }
  // The scope is the physical identity of THIS product, not all 75kg products.
  assert.equal(isSaleVariantAllowed('other-product', productionVariant), true);
  assert.throws(() => expandCommercialOrderItem(
    { id: glucoseId, unit: 'un', variation_mode: 'variacoes_fisicas', is_active: true },
    { id: productionVariant, product_id: glucoseId, unit: 'g', is_active: true },
    1, 520,
  ), /exclusiva para produção/);
  // A fabricated composite offer cannot bypass the production-only restriction.
  const composite = {
    id: 'bad-sale', product_id: glucoseId, variant_id: null,
    name: 'G0 experimental', commercial_unit_label: 'kit',
    conversion_factor: 1, composition_mode: 'composite' as const,
    components: [{product_id: glucoseId, variant_id: productionVariant, quantity: 1}],
    is_active: true, notes: null, created_at: '', updated_at: '',
  };
  assert.throws(() => expandCommercialOrderItem(
    { id: glucoseId, unit: 'un', variation_mode: 'variacoes_fisicas', is_active: true },
    null, 1, 520, composite, undefined,
    {products: [{id: glucoseId, unit:'un', variation_mode:'variacoes_fisicas', is_active:true}],
      variants: [{id:productionVariant,product_id:glucoseId,unit:'g',is_active:true}]},
  ), /exclusiva para produção/);
});

test('Glucodry GD1 continua em gramas; GD2 é exatamente um saco lacrado', () => {
  const product = { id: GLUCODRY_PRODUCT_ID, unit: 'g', variation_mode: 'sem_variacao', is_active: true, price: 0.01999 };
  const gd1: CommercialPresentation = {
    id: 'gd1', product_id: product.id, variant_id: null, name: 'kg', commercial_unit_label: 'kg',
    composition_mode: 'single', conversion_factor: 1000, is_active: true, notes: null, created_at: '', updated_at: '',
  };
  for (const kg of [1,2,3,4]) {
    const [line] = expandCommercialOrderItem(product, null, kg, 21.99, gd1);
    assert.equal(line.quantity, kg * 1000);
    assert.equal(line.physical_unit_label, 'g');
    assert.equal(line.commercial_quantity, kg);
  }
  const gd2: CommercialPresentation = {
    id: GLUCODRY_GD2_PRESENTATION_ID, product_id: product.id, variant_id: null,
    name: 'Saco fechado original 25 kg', commercial_unit_label: 'saco', composition_mode: 'single',
    conversion_factor: 1, is_active: true, notes: null, created_at: '', updated_at: '',
  };
  const [bag] = expandCommercialOrderItem(product,null,1,449,gd2);
  assert.equal(bag.product_id, GLUCODRY_PRODUCT_ID);
  assert.equal(bag.quantity,1);
  assert.equal(bag.physical_unit_label,'saco');
  assert.equal(bag.commercial_presentation_id,GLUCODRY_GD2_PRESENTATION_ID);
  assert.equal(getOrderItemLineTotal(bag),449);
  assert.throws(() => expandCommercialOrderItem(product,null,2,449,gd2),/somente um saco/);
});

test('Chocolate CB3: saco original lacrado não consome gramas abertas', () => {
  const product={id:CHOCOLATE_BASE_PRODUCT_ID,unit:'g',variation_mode:'variacoes_fisicas',is_active:true,price:null};
  const branco={id:'f6588f52-6e28-4ce9-b492-a95c847d5c0c',product_id:product.id,unit:'g',is_active:true,price_override:0.0165};
  const amargo={id:'1a3d59a6-4712-4afd-811a-5a72aad76fa9',product_id:product.id,unit:'g',is_active:true,price_override:0.0175};
  const make=(id:string,variantId:string):CommercialPresentation=>({
    id,product_id:product.id,variant_id:variantId,name:'Saco original fechado 20 kg',
    commercial_unit_label:'saco',conversion_factor:1,composition_mode:'single',
    is_active:true,notes:null,created_at:'',updated_at:'',
  });
  const cb3Branco=make(CHOCOLATE_CB3_BRANCO_ID,branco.id);
  const cb3Amargo=make(CHOCOLATE_CB3_MEIO_AMARGO_ID,amargo.id);
  assert.equal(isChocolateCB3(cb3Branco.id),true);
  assert.equal(isChocolateCB3(cb3Amargo.id),true);
  assert.equal(getDefaultCommercialUnitPrice(product,branco,cb3Branco),0); // commercial price NOT cost/g
  for(const [variant,presentation,price] of [[branco,cb3Branco,355],[amargo,cb3Amargo,390]] as const){
    const [line]=expandCommercialOrderItem(product,variant,4,price,presentation);
    assert.equal(line.quantity,4); // 4 original sealed sacks, NOT 80,000g
    assert.equal(line.commercial_quantity,4);
    assert.equal(line.physical_unit_label,'saco');
    assert.equal(line.variant_id,variant.id);
    assert.equal(line.commercial_presentation_id,presentation.id);
    assert.equal(getOrderItemLineTotal(line),4*price);
    assert.throws(()=>expandCommercialOrderItem(product,variant,1,0,presentation),/preço comercial/);
    assert.throws(()=>expandCommercialOrderItem(product,variant,1.5,price,presentation),/saco original lacrado/);
  }
  assert.throws(()=>expandCommercialOrderItem(product,amargo,1,390,cb3Branco),/cobertura correta/);
});

test('Chocolate CB1/CB2 preservado em gramas no mesmo Produto Mestre', () => {
  const product={id:CHOCOLATE_BASE_PRODUCT_ID,unit:'g',variation_mode:'variacoes_fisicas',is_active:true,price:null};
  const branco={id:'f6588f52-6e28-4ce9-b492-a95c847d5c0c',product_id:product.id,unit:'g',is_active:true,price_override:0.0165};
  const kg:CommercialPresentation={
    id:'576743c6-67a8-4ad2-8fb1-8a171f6e2e82',product_id:product.id,variant_id:branco.id,
    name:'kg',commercial_unit_label:'kg',conversion_factor:1000,composition_mode:'single',
    is_active:true,notes:null,created_at:'',updated_at:'',
  };
  const [line]=expandCommercialOrderItem(product,branco,10,210,kg);
  assert.equal(line.quantity,10000);
  assert.equal(line.physical_unit_label,'g');
  assert.equal(getOrderItemLineTotal(line),2100);
});


test('Chocoim 34g: 3 coberturas x 5 apresentações usam as variantes reais e somente unidades físicas',()=>{
  const product={id:'e01a87f3-615d-4330-87c6-d0f9878a7c3b', unit:'un',variation_mode:'variacoes_fisicas',is_active:true,price:1.4};
  const covers=[
    ['Branco','66708945-22f3-43bf-b68e-127021448cd8'],
    ['Meio Amargo','3e67edc6-1cb7-463e-8c8e-a50bfb5092f7'],
    ['Mesclado','1a84c7f3-4130-45fc-920f-62aecafe4c91'],
  ];
  const packages=[
    ['Degustação 8','kit',8],
    ['Bandeja 20','bandeja',20],
    ['Kit 40','kit',40],
    ['Kit 80','kit',80],
    ['Caixa 560 (28 bandejas de 20)','caixa',560],
  ] as const;
  for(const [cover,variantId] of covers) {
    const variant={id:variantId,product_id:product.id,unit:'un',is_active:true};
    for(const [name,unit,conversion] of packages){
      const presentation:CommercialPresentation={
        id:`test-${cover}-${conversion}`,product_id:product.id,
        variant_id:variantId,name:`Chocoim 34g — ${name} — ${cover}`,
        commercial_unit_label:unit,conversion_factor:conversion,
        composition_mode:'single',is_active:true,notes:null,created_at:'',updated_at:'',
      };
      for(const quantity of [1,3]){
        const rows=expandCommercialOrderItem(product,variant,quantity,12.35,presentation);
        assert.equal(rows.length,1);
        assert.equal(rows[0].product_id,product.id);
        assert.equal(rows[0].variant_id,variantId);
        assert.equal(rows[0].quantity,conversion*quantity);
        assert.equal(rows[0].commercial_quantity,quantity);
        assert.equal(rows[0].commercial_unit_label,unit);
        assert.equal(rows[0].commercial_conversion_factor,conversion);
        assert.equal(rows[0].physical_unit_label,'un');
        assert.equal(getOrderItemLineTotal(rows[0]),12.35*quantity);
      }
    }
  }
});
test('Chocoim 34g: atacado multiplica Kit 40 sem criar nova apresentação física',()=>{
  const product={id:'e01a87f3-615d-4330-87c6-d0f9878a7c3b',unit:'un',variation_mode:'variacoes_fisicas',is_active:true};
  const variant={id:'3e67edc6-1cb7-463e-8c8e-a50bfb5092f7',product_id:product.id,unit:'un',is_active:true};
  const pres:CommercialPresentation={id:'kit40',product_id:product.id,variant_id:variant.id,
    name:'Chocoim 34g — Kit 40 — Meio Amargo',commercial_unit_label:'kit',
    conversion_factor:40,composition_mode:'single',is_active:true,notes:null,
    created_at:'',updated_at:''};
  const [sale]=expandCommercialOrderItem(product,variant,13,180,pres);
  assert.equal(sale.quantity,520);
  assert.equal(sale.commercial_quantity,13);
  assert.equal(sale.physical_unit_label,'un');
  assert.equal(getOrderItemLineTotal(sale),2340);
});


test('Chocoim Misto: 4 apresentacoes compostas usam SOMENTE Preto + Branco, nunca Mesclado',()=>{
  const pid='e01a87f3-615d-4330-87c6-d0f9878a7c3b';
  const black='3e67edc6-1cb7-463e-8c8e-a50bfb5092f7';
  const white='66708945-22f3-43bf-b68e-127021448cd8';
  const mesclado='1a84c7f3-4130-45fc-920f-62aecafe4c91';
  const product={id:pid,unit:'un',variation_mode:'variacoes_fisicas',is_active:true};
  const physCatalog={products:[product],variants:[black,white,mesclado].map(id=>({
    id,product_id:pid,unit:'un',is_active:true,
  }))};
  const formats=[
    ['c34c0a34-2026-4000-8000-000000000020','bandeja',20,10],
    ['c34c0a34-2026-4000-8000-000000000040','kit',40,20],
    ['c34c0a34-2026-4000-8000-000000000080','kit',80,40],
    ['c34c0a34-2026-4000-8000-000000000560','caixa',560,280],
  ] as const;
  for(const [id,commercialUnit,total,perFlavor] of formats){
    const presentation:CommercialPresentation={
      id,product_id:pid,variant_id:null,name:'Chocoim 34g — Misto',
      commercial_unit_label:commercialUnit,conversion_factor:total,composition_mode:'composite',
      is_active:true,notes:null,created_at:'',updated_at:'',
      components:[
        {product_id:pid,variant_id:black,quantity:perFlavor},
        {product_id:pid,variant_id:white,quantity:perFlavor},
      ],
    };
    for(const quantity of [1,3,13]){
      const rows=expandCommercialOrderItem(product,null,quantity,18.75,presentation,undefined,physCatalog);
      assert.equal(rows.length,2);
      assert.equal(rows.reduce((sum,row)=>sum+row.quantity,0),quantity*total);
      assert.deepEqual(rows.map(x=>[x.variant_id,x.quantity]),[
        [black,perFlavor*quantity],[white,perFlavor*quantity],
      ]);
      assert.ok(rows.every(x=>x.product_id===pid && x.physical_unit_label==='un'));
      assert.ok(rows.every(x=>x.commercial_presentation_id===id && x.commercial_quantity===quantity));
      assert.equal(new Set(rows.map(x=>x.commercial_group_id)).size,1);
      assert.equal(rows.some(x=>x.variant_id===mesclado),false);
      assert.equal(Math.round(rows.reduce((sum,row)=>sum+getOrderItemLineTotal(row),0)*100),1875*quantity);
    }
  }
});

test('Chocoim Mesclado permanece UMA variante fisica single, nao dois componentes',()=>{
  const pid='e01a87f3-615d-4330-87c6-d0f9878a7c3b';
  const mesclado='1a84c7f3-4130-45fc-920f-62aecafe4c91';
  const product={id:pid,unit:'un',variation_mode:'variacoes_fisicas',is_active:true};
  const variant={id:mesclado,product_id:pid,unit:'un',is_active:true};
  const p:CommercialPresentation={id:'single-mesclado-20',product_id:pid,variant_id:mesclado,
    name:'Chocoim 34g — Bandeja 20 — Mesclado',commercial_unit_label:'bandeja',
    conversion_factor:20,composition_mode:'single',is_active:true,notes:null,created_at:'',updated_at:''};
  const rows=expandCommercialOrderItem(product,variant,2,42.25,p);
  assert.equal(rows.length,1);
  assert.equal(rows[0].variant_id,mesclado);
  assert.equal(rows[0].quantity,40);
  assert.equal(getOrderItemLineTotal(rows[0]),84.5);
});


test('AM1 Amendoim Torrado: kits 2/3 kg usam gramas da identidade EG, sem variantes nem pacote físico paralelo',()=>{
  const product={id:'c177f332-a1c7-4276-9cef-7b81af920174',unit:'g',
    variation_mode:'sem_variacao',is_active:true,price:0.016};
  for(const [name,conversion,commercialId] of [
    ['Kit 2 pacotes de 1 kg',2000,'a11e0000-0000-4000-8000-000000002000'],
    ['Kit 3 pacotes de 1 kg',3000,'a11e0000-0000-4000-8000-000000003000'],
  ] as const){
    const pres:CommercialPresentation={
      id:commercialId,product_id:product.id,variant_id:null,name,
      commercial_unit_label:'kit',conversion_factor:conversion,
      composition_mode:'single',is_active:true,notes:null,
      created_at:'',updated_at:'',
    };
    for(const qty of [1,2,5]){
      const rows=expandCommercialOrderItem(product,null,qty,42.50,pres);
      assert.equal(rows.length,1);
      const row=rows[0];
      assert.equal(row.product_id,product.id);
      assert.equal(row.variant_id,null);
      assert.equal(row.quantity,qty*conversion);
      assert.equal(row.commercial_quantity,qty);
      assert.equal(row.commercial_presentation_id,commercialId);
      assert.equal(row.commercial_presentation_name,name);
      assert.equal(row.physical_unit_label,'g');
      assert.equal(row.commercial_conversion_factor,conversion);
      assert.equal(getOrderItemLineTotal(row),qty*42.50);
    }
  }
});


test('AM3 vende saco original 24kg como saco inteiro, sem consumir EG em gramas',()=>{
  const product={id:'c177f332-a1c7-4276-9cef-7b81af920174',unit:'g',variation_mode:'sem_variacao',is_active:true,price:0.015};
  const present:CommercialPresentation={
    id:'a3400000-0000-4000-8000-000000002400',product_id:product.id,variant_id:null,
    name:'Saco original fechado 24 kg',commercial_unit_label:'saco',conversion_factor:1,
    composition_mode:'single',is_active:true,notes:null,created_at:'',updated_at:'',
  };
  assert.equal(getDefaultCommercialUnitPrice(product,null,present),0);
  for(const q of [1,2,4]){
    const [item]=expandCommercialOrderItem(product,null,q,220,present);
    assert.equal(item.quantity,q);
    assert.equal(item.commercial_quantity,q);
    assert.equal(item.physical_unit_label,'saco');
    assert.equal(item.variant_id,null);
    assert.equal(getOrderItemLineTotal(item),q*220);
  }
  for(const invalid of [0,1.5,-1]){
    assert.throws(()=>expandCommercialOrderItem(product,null,invalid,220,present),/AM3/);
  }
  assert.throws(()=>expandCommercialOrderItem(product,null,1,0,present),/preço/);
  const [grams]=expandCommercialOrderItem(product,null,2,25,{
    ...present,id:'a11e0000-0000-4000-8000-000000002000',
    name:'Kit 2 pacotes de 1 kg',conversion_factor:2000,commercial_unit_label:'kit',
  });
  assert.equal(grams.quantity,4000);
  assert.equal(grams.physical_unit_label,'g');
});
