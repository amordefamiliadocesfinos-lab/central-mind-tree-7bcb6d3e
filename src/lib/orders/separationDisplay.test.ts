import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeparationDisplayEntries, type SeparationSourceItem } from './separationDisplay';

type Item = SeparationSourceItem;
const source = (id: string, product: string, variant: string | null, physicalQuantity: number,
  values: Partial<Item> = {}): Item => ({
  id,product_id: product,variant_id:variant,quantity:physicalQuantity,
  product: { name: product },variant: variant ? {variant_name:variant} : null,
  physical_unit_label:'un',...values,
});

test('mix 40g: um único kit de 30, seis sabores físicos, sem 1 kit repetido',()=>{
  const group='commercial-40';
  const base={
    commercial_group_id:group,commercial_presentation_id:'mix40',
    commercial_presentation_name:'Trufa 40g — Mix 6 Sabores 30',
    commercial_quantity:1,commercial_unit_label:'kit',commercial_conversion_factor:5,
  };
  const items=['Brigadeiro','Amendoim','Morango','Maracujá','Beijinho','Leite em Pó']
    .map((flavor,index)=>source('row'+index,'TRUFA ARTESANAL 40G',flavor,5,base));
  const [display]=createSeparationDisplayEntries(items);
  assert.equal(createSeparationDisplayEntries(items).length,1);
  assert.equal(display.productName,'TRUFA ARTESANAL 40G');
  assert.equal(display.commercialSummary,'1 kit · 30 un');
  assert.equal(display.components.length,6);
  assert.equal(display.totalText,'Total para separar: 30 un');
  assert.equal(display.components[1].quantityText,'5 un');
  assert.equal(display.components.some(x=>x.quantityText.includes('kit')),false);
});

test('duas unidades do mesmo mix apresentam 2 kits e 60 unidades',()=>{
  const rows=Array.from({length:6},(_,i)=>source('mix'+i,'TRUFA ARTESANAL 40G','Sabor '+i,10,{
    commercial_group_id:'group1',commercial_presentation_id:'mix40',
    commercial_presentation_name:'Trufa 40g — Mix 6 Sabores 30',
    commercial_quantity:2,commercial_unit_label:'kit',commercial_conversion_factor:5,
  }));
  const [display]=createSeparationDisplayEntries(rows);
  assert.equal(display.commercialSummary,'2 kits · 60 un');
  assert.equal(display.components.length,6);
});

test('trufa 30g: composição Amendoim no Mestre 40g não duplica apresentação',()=>{
  const base={
    commercial_group_id:'one-30',commercial_presentation_id:'mix30',
    commercial_presentation_name:'Trufa 30g — Mix 6 Sabores 30',
    commercial_quantity:1,commercial_unit_label:'kit',commercial_conversion_factor:5,
  };
  const rows=[
    ...['Brigadeiro','Morango','Maracujá','Beijinho','Leite em Pó']
      .map((flavor,i)=>source('t30-'+i,'TRUFA ARTESANAL 30G',flavor,5,{...base,product_id:'t30'})),
    source('amd','TRUFA ARTESANAL 40G','Amendoim',5,{...base,product_id:'t40'}),
  ];
  const [display]=createSeparationDisplayEntries(rows);
  assert.equal(display.commercialSummary,'1 kit · 30 un');
  assert.equal(display.productName,'TRUFA ARTESANAL 30G');
  assert.equal(display.components.length,6);
  assert.match(display.components.at(-1)?.label || '',/Amendoim.*TRUFA ARTESANAL 40G/);
});

test('Alfajor misto: 3 bandejas, 9 Preto + 9 Branco por bandeja, total 54',()=>{
  const common={
    product_id:'alf',commercial_group_id:'bandeja18',commercial_presentation_id:'mix-alf',
    commercial_presentation_name:'Bandeja 18 — 9BRANCO + 9PRETO',
    commercial_quantity:3,commercial_unit_label:'bandeja',commercial_conversion_factor:9,
  };
  const entries=createSeparationDisplayEntries([
    source('alf-branco','ALFAJOR ARTESANAL 60G DOCE DE LEITE','Chocolate Branco',27,common),
    source('alf-preto','ALFAJOR ARTESANAL 60G DOCE DE LEITE','Chocolate Meio Amargo',27,common),
  ]);
  assert.equal(entries.length,1);
  assert.equal(entries[0].presentationName,'Bandeja Mista');
  assert.equal(entries[0].commercialSummary,'3 bandejas · 54 un');
  assert.equal(entries[0].composition,'9 Preto + 9 Branco por bandeja');
  assert.equal(entries[0].components.length,0); // don't duplicate 27+27 in operator card
});

test('Alfajor mixto histórico 6 Branco + 12 Preto mantém proporção verdadeira',()=>{
  const opts={ product_id:'alf',commercial_group_id:'bandeja6-12',
    commercial_presentation_id:'mix62',commercial_quantity:1,
    commercial_unit_label:'bandeja',commercial_conversion_factor:6 };
  const rows=[
    source('b','ALFAJOR ARTESANAL 60G','Chocolate Branco',6,opts),
    source('p','ALFAJOR ARTESANAL 60G','Chocolate Meio Amargo',12,opts),
  ];
  const [view]=createSeparationDisplayEntries(rows);
  assert.equal(view.composition,'12 Preto + 6 Branco por bandeja');
  assert.equal(view.commercialSummary,'1 bandeja · 18 un');
});

test('Glucodry simples: 6 kg e 6.000 g, sem rótulo Produto simples',()=>{
  const [view]=createSeparationDisplayEntries([
    source('gd','GLUCODRY',null,6000,{
      physical_unit_label:'g',commercial_quantity:6,
      commercial_unit_label:'kg',commercial_conversion_factor:1000,commercial_presentation_name:'kg',
    }),
  ]);
  assert.equal(view.commercialSummary,'6 kg');
  assert.deepEqual(view.components.map(x=>[x.label,x.quantityText]),[['Quantidade física','6.000 g']]);
});

test('Biscoito: 2 pacotes de 22 e 44 un sem converter a baixa',()=>{
  const [view]=createSeparationDisplayEntries([
    source('bs','BISCOITO PARA ALFAJOR','Tradicional',44,{
      commercial_quantity:2,commercial_unit_label:'pacote',commercial_conversion_factor:22,
      commercial_presentation_id:'pacote22',commercial_presentation_name:'Pacote 22 un',
    }),
  ]);
  assert.equal(view.commercialSummary,'2 pacotes de 22 un');
  assert.deepEqual(view.components.map(x=>[x.label,x.quantityText]),[['Tradicional','44 un']]);
});

test('legado sem commercial_group_id não inventa kit nem une linhas',()=>{
  const entries=createSeparationDisplayEntries([
    source('a','TRUFA 40G','Brigadeiro',5,{commercial_quantity:1,
      commercial_unit_label:'kit',commercial_conversion_factor:5}),
    source('b','TRUFA 40G','Morango',5,{commercial_quantity:1,
      commercial_unit_label:'kit',commercial_conversion_factor:5}),
  ]);
  assert.equal(entries.length,2);
  assert.ok(entries.every(x=>x.composition==null));
  assert.ok(entries.every(x=>x.components.length===1));
});

test('snapshots conflitantes preservam itens físicos sem afirmar quantidade de kits',()=>{
  const entries=createSeparationDisplayEntries([
    source('a','TRUFA 40G','Brigadeiro',5,{commercial_group_id:'old',
      commercial_presentation_id:'p1',commercial_quantity:1,commercial_unit_label:'kit'}),
    source('b','TRUFA 40G','Morango',5,{commercial_group_id:'old',
      commercial_presentation_id:'p2',commercial_quantity:2,commercial_unit_label:'kit'}),
  ]);
  assert.equal(entries.length,1);
  assert.equal(entries[0].commercialSummary,undefined);
  assert.equal(entries[0].components.length,2);
});
