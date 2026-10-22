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

test('Shopee PED-00298: variation 2 pacote 44 uni exibe dois pacotes sem snapshot comercial',()=>{
  const [view]=createSeparationDisplayEntries([
    source('feeb5074-288e-451c-bacb-7bcdba9b92f1','BISCOITO PARA ALFAJOR','Tradicional',44,{
      product_id:'c4580ad6-e53a-4a36-9696-a65f2a95da00',
      variant_id:'fa0814a0-9cd0-4d8a-b01d-2febdd1d7dcc',
      notes:'Shopee Open Platform | external_item_key=code:SH-0042-018|variation:2 pacote 44 uni biscoito tradicional | item_id=58253351888 | physical_multiplier=44 | commercial_quantity=1',
      commercial_quantity:null,commercial_unit_label:null,commercial_presentation_id:null,
    }),
  ]);
  assert.equal(view.commercialSummary,'2 pacotes de 22 un');
  assert.deepEqual(view.components.map(x=>[x.label,x.quantityText]),[['Tradicional','44 un']]);
});

test('Shopee histórico: 3 pacotes 66 unidades permanecem três pacotes',()=>{
  const [view]=createSeparationDisplayEntries([
    source('ped194','BISCOITO PARA ALFAJOR','Tradicional',66,{
      product_id:'c4580ad6-e53a-4a36-9696-a65f2a95da00',
      variant_id:'fa0814a0-9cd0-4d8a-b01d-2febdd1d7dcc',
      notes:'Shopee comercial: 1 | Multiplicador físico: 66 | code:SH-004-018|variation:3 pacote 66 uni biscoito tradicional | 22 a 24 Unid por Pacote',
    }),
  ]);
  assert.equal(view.commercialSummary,'3 pacotes de 22 un');
});

test('dois itens marketplace de 2 pacotes cada mostram 4 pacotes para 88 un',()=>{
  const [view]=createSeparationDisplayEntries([
    source('mult','BISCOITO PARA ALFAJOR','Tradicional',88,{
      product_id:'c4580ad6-e53a-4a36-9696-a65f2a95da00',
      variant_id:'fa0814a0-9cd0-4d8a-b01d-2febdd1d7dcc',
      notes:'Shopee Open Platform | external_item_key=X|variation:2 pacote 44 uni biscoito tradicional | physical_multiplier=44 | commercial_quantity=2',
    }),
  ]);
  assert.equal(view.commercialSummary,'4 pacotes de 22 un');
});

test('44 un sem variação Shopee explícita não autoriza inferir dois pacotes',()=>{
  const base={product_id:'c4580ad6-e53a-4a36-9696-a65f2a95da00',
    variant_id:'fa0814a0-9cd0-4d8a-b01d-2febdd1d7dcc'};
  for (const notes of [
    null,
    'Pedido manual de 44 unidades',
    'Shopee Open Platform | variation:2 pacote 66 uni biscoito tradicional',
    'Shopee Open Platform | variation:1 caixa 44 uni biscoito tradicional',
  ]) {
    const [view]=createSeparationDisplayEntries([source('b','BISCOITO PARA ALFAJOR','Tradicional',44,{...base,notes})]);
    assert.equal(view.commercialSummary,undefined);
    assert.equal(view.components[0].quantityText,'44 un');
  }
});

test('Outro produto ou caixa física de Biscoito não herda pacotes pelo texto',()=>{
  const fakeNotes='Shopee Open Platform | variation:2 pacote 44 uni biscoito tradicional';
  for(const [productId,variantId] of [
    ['other-product','fa0814a0-9cd0-4d8a-b01d-2febdd1d7dcc'],
    ['c4580ad6-e53a-4a36-9696-a65f2a95da00','a36f690f-39db-4ecd-a8f7-1cc27a266a44'],
  ]){
    const [view]=createSeparationDisplayEntries([source('x','Produto','Tradicional',44,{
      product_id:productId,variant_id:variantId,notes:fakeNotes,
    })]);
    assert.equal(view.commercialSummary,undefined);
  }
});

test('padrão universal: futuro produto com pacote configurado herda a mesma UX automaticamente',()=>{
  const [view]=createSeparationDisplayEntries([
    source('new1','PRODUTO FUTURO','Chocolate',72,{
      product_id:'produto-novo-ainda-nao-existente',
      commercial_presentation_id:'presentation-futura',
      commercial_presentation_name:'Caixa 24',
      commercial_quantity:3,commercial_unit_label:'caixa',
      commercial_conversion_factor:24,
    }),
  ]);
  assert.equal(view.productName,'PRODUTO FUTURO');
  assert.equal(view.commercialSummary,'3 caixas de 24 un');
  assert.equal(view.components[0].quantityText,'72 un');
});

test('padrão universal: kit composto futuro exibe uma apresentação e componentes, sem repetir kits',()=>{
  const part={commercial_presentation_id:'future-kit',commercial_group_id:'future-group',
    commercial_quantity:2,commercial_unit_label:'kit',commercial_conversion_factor:4,
    commercial_presentation_name:'Mix Futuro — 3 Sabores'};
  const rows=['A','B','C'].map((v,i)=>source('future'+i,'PRODUTO FUTURO',v,8,part));
  const [view]=createSeparationDisplayEntries(rows);
  assert.equal(view.commercialSummary,'2 kits · 24 un');
  assert.equal(view.components.length,3);
  assert.equal(view.components.every(x=>x.quantityText==='8 un'),true);
});

test('Shopee: novo produto com 4 kits de 72 unidades exibe pacotes sem regra por produto',()=>{
  const [view]=createSeparationDisplayEntries([source('f','PRODUTO FUTURO','Futuro',72,{
    product_id:'future-product-id',
    notes:'Shopee Open Platform |variation:4 kit 72 uni | physical_multiplier=72 | commercial_quantity=1',
  })]);
  assert.equal(view.commercialSummary,'4 kits de 18 un');
  assert.equal(view.components[0].quantityText,'72 un');
});

test('Shopee: Glucodry 4kg x2 utiliza gramas como quantidade física e 8kg como comercial',()=>{
  const [view]=createSeparationDisplayEntries([source('gd2','GLUCODRY',null,8000,{
    physical_unit_label:null,product:{name:'GLUCODRY',unit:'g'},
    notes:'Shopee Open Platform | variation:4 kg | physical_multiplier=4000 | commercial_quantity=2',
  })]);
  assert.equal(view.commercialSummary,'8 kg');
  assert.equal(view.components[0].quantityText,'8.000 g');
});

test('Shopee: Porto Gel embalagem física de 1 kg tem rótulo sem confundir com 1000g disponíveis',()=>{
  const [view]=createSeparationDisplayEntries([source('pg','EMULSIFICANTE PORTO GEL','1 kg — embalagem fechada',2,{
    notes:'Shopee Open Platform | variation:1 kg | physical_multiplier=1 | commercial_quantity=2',
  })]);
  assert.equal(view.commercialSummary,'2 embalagens de 1 kg');
  assert.equal(view.components[0].quantityText,'2 un');
});

test('padrão conservador: notas incompletas e componentes externos não inventam embalagem',()=>{
  const notes=[
    'Shopee Open Platform |variation:4 kit 72 uni | physical_multiplier=36 | commercial_quantity=1',
    'Shopee Open Platform |variation:4 kit 72 uni | physical_multiplier=72 | commercial_quantity=1 | composition_position=1',
    'Shopee comercial: 1 | Multiplicador físico: 72 | code:foo|variation:4 kit 72 uni | composição 1/2',
    'Mercado Livre |variation:4 kit 72 uni | physical_multiplier=72 | commercial_quantity=1',
  ];
  for(const [i,note] of notes.entries()){
    const [view]=createSeparationDisplayEntries([source('negative'+i,'PRODUTO FUTURO','Futuro',72,{notes:note})]);
    assert.equal(view.commercialSummary,undefined,`item ${i}`);
  }
});

test('padrão conservador: snapshot de pacote com quantidade física incompatível mostra só o real',()=>{
  const [view]=createSeparationDisplayEntries([source('bad','PRODUTO FUTURO','Tradicional',40,{
    commercial_presentation_id:'p',commercial_quantity:2,commercial_unit_label:'pacote',
    commercial_conversion_factor:22,
  })]);
  assert.equal(view.commercialSummary,undefined);
  assert.equal(view.components[0].quantityText,'40 un');
});

test('Shopee Open Platform: composição_position=0 com linha única é produto simples, não kit composto',()=>{
  const [view]=createSeparationDisplayEntries([source('single','GLUCODRY',null,4000,{
    physical_unit_label:null,product:{name:'GLUCODRY',unit:'g'},
    notes:'Shopee Open Platform | external_item_key=code:SH-002-006|variation:4 kg | mapping_id=22cb73db-87be-43bd-811e-1abbda3c1231 | composition_position=0 | commercial_quantity=1 | physical_multiplier=4000',
  })]);
  assert.equal(view.commercialSummary,'4 kg');
  assert.equal(view.components[0].quantityText,'4.000 g');
});

test('Shopee Open Platform: mesmo mapping em dois componentes não repete kit em cada linha',()=>{
  const mapping='d4adc1b7-a1c8-40c2-9185-5bf132613187';
  const notes=(position:number)=>`Shopee Open Platform | external_item_key=code:MIX-30|variation:1 kit 30 uni | mapping_id=${mapping} | composition_position=${position} | commercial_quantity=1 | physical_multiplier=30`;
  const view=createSeparationDisplayEntries([
    source('mix1','TRUFA 30G','Brigadeiro',30,{notes:notes(0)}),
    source('mix2','TRUFA 30G','Morango',30,{notes:notes(1)}),
  ]);
  assert.equal(view.length,2);
  assert.ok(view.every(x=>x.commercialSummary==null));
  assert.deepEqual(view.map(x=>x.components[0].quantityText),['30 un','30 un']);
});

test('Shopee Open Platform: posição zero isolada e multiplicador inteiro autorizam kit comercial único',()=>{
  const [view]=createSeparationDisplayEntries([source('singleton','PRODUTO FUTURO','Misto',72,{
    notes:'Shopee Open Platform |external_item_key=code:MIX-72|variation:4 kit 72 uni | mapping_id=22cb73db-87be-43bd-811e-1abbda3c1232 | composition_position=0 | commercial_quantity=1 | physical_multiplier=72',
  })]);
  assert.equal(view.commercialSummary,'4 kits de 18 un');
});


test('Chocoim Misto 20: 3 bandejas exibem 10 Preto + 10 Branco por bandeja e 60un',()=>{
  const pid='e01a87f3-615d-4330-87c6-d0f9878a7c3b';
  const common={product_id:pid,commercial_group_id:'chocoim-one-mixed-bandeja',
    commercial_presentation_id:'c34c0a34-2026-4000-8000-000000000020',
    commercial_presentation_name:'Chocoim 34g — Bandeja Mista 20 (10 Preto + 10 Branco)',
    commercial_quantity:3,commercial_unit_label:'bandeja',commercial_conversion_factor:10};
  const rows=[
    source('black','CHOCOIM ARTESANAL 34G','Meio Amargo',30,{
      ...common,variant_id:'3e67edc6-1cb7-463e-8c8e-a50bfb5092f7'
    }),
    source('white','CHOCOIM ARTESANAL 34G','Branco',30,{
      ...common,variant_id:'66708945-22f3-43bf-b68e-127021448cd8'
    }),
  ];
  const [view]=createSeparationDisplayEntries(rows);
  assert.equal(view.productName,'CHOCOIM ARTESANAL 34G');
  assert.equal(view.presentationName,'Bandeja Mista');
  assert.equal(view.commercialSummary,'3 bandejas · 60 un');
  assert.equal(view.composition,'10 Preto + 10 Branco por bandeja');
  assert.equal(view.components.length,0);
});

test('Chocoim misto 40/80/560 em multiplos usa somente quantidades de preto e branco',()=>{
  const pid='e01a87f3-615d-4330-87c6-d0f9878a7c3b';
  const formats=[
    [40,'c34c0a34-2026-4000-8000-000000000040','kit',20,'Kit Misto','20 Preto + 20 Branco por kit'],
    [80,'c34c0a34-2026-4000-8000-000000000080','kit',40,'Kit Misto','40 Preto + 40 Branco por kit'],
    [560,'c34c0a34-2026-4000-8000-000000000560','caixa',280,'Caixa Mista','280 Preto + 280 Branco por caixa (28 bandejas de 20)'],
  ] as const;
  for(const [total,id,unit,half,title,composition] of formats) {
    const shared={product_id:pid,commercial_group_id:'mix-'+id,
      commercial_presentation_id:id,commercial_presentation_name:'Chocoim 34g — Misto',
      commercial_quantity:2,commercial_unit_label:unit,commercial_conversion_factor:half};
    const [view]=createSeparationDisplayEntries([
      source('black'+id,'CHOCOIM 34g','Meio Amargo',half*2,{
        ...shared,variant_id:'3e67edc6-1cb7-463e-8c8e-a50bfb5092f7'}),
      source('white'+id,'CHOCOIM 34g','Branco',half*2,{
        ...shared,variant_id:'66708945-22f3-43bf-b68e-127021448cd8'}),
    ]);
    assert.equal(view.presentationName,title);
    assert.equal(view.commercialSummary,`2 ${unit === 'caixa' ? 'caixas' : 'kits'} · ${(total*2).toLocaleString('pt-BR')} un`);
    assert.equal(view.composition,composition);
    assert.equal(view.components.length,0);
  }
});

test('Chocoim Mesclado single permanece separado e nao vira Misto',()=>{
  const [view]=createSeparationDisplayEntries([
    source('mes','CHOCOIM ARTESANAL 34G','Mesclado',40,{
      product_id:'e01a87f3-615d-4330-87c6-d0f9878a7c3b',
      variant_id:'1a84c7f3-4130-45fc-920f-62aecafe4c91',
      commercial_quantity:2,commercial_unit_label:'bandeja',commercial_conversion_factor:20,
      commercial_presentation_id:'8f452863-971d-4e0d-b4be-d8909d9c89f8',
      commercial_presentation_name:'Chocoim 34g — Bandeja 20 — Mesclado',
    }),
  ]);
  assert.equal(view.commercialSummary,'2 bandejas de 20 un');
  assert.equal(view.components[0].label,'Mesclado');
  assert.equal(view.components[0].quantityText,'40 un');
  assert.equal(view.composition,undefined);
});


test('AM1 Amendoim: 1 kit de 2kg exibe PREPARAR dois pacotes de 1kg sem estoque de pacotes',()=>{
  const [view]=createSeparationDisplayEntries([
    source('am2','AMENDOIM TORRADO',null,2000,{
      product_id:'c177f332-a1c7-4276-9cef-7b81af920174',
      physical_unit_label:'g',
      commercial_presentation_id:'a11e0000-0000-4000-8000-000000002000',
      commercial_presentation_name:'Kit 2 pacotes de 1 kg',
      commercial_unit_label:'kit',commercial_quantity:1,
      commercial_conversion_factor:2000,
    }),
  ]);
  assert.equal(view.commercialSummary,'1 kit · preparar 2 pacotes de 1 kg');
  assert.equal(view.components[0].quantityText,'2.000 g');
  assert.equal(view.components.length,1);
});

test('AM1 Amendoim: 2 kits de 3kg exigem 6 pacotes e 6000g, sem multiplicar saldo',()=>{
  const [view]=createSeparationDisplayEntries([
    source('am3','AMENDOIM TORRADO',null,6000,{
      product_id:'c177f332-a1c7-4276-9cef-7b81af920174',
      physical_unit_label:'g',commercial_presentation_id:'a11e0000-0000-4000-8000-000000003000',
      commercial_presentation_name:'Kit 3 pacotes de 1 kg',
      commercial_quantity:2,commercial_unit_label:'kit',
      commercial_conversion_factor:3000,
    }),
  ]);
  assert.equal(view.commercialSummary,'2 kits · preparar 6 pacotes de 1 kg');
  assert.equal(view.components[0].quantityText,'6.000 g');
});

test('UX de pacotes fracionados funciona também para futuro Produto Mestre em gramas',()=>{
  const [view]=createSeparationDisplayEntries([
    source('future','NOVO PRODUTO',null,6000,{
      physical_unit_label:'g',commercial_presentation_name:'Kit 3 pacotes de 1 kg',
      commercial_unit_label:'kit',commercial_quantity:2,commercial_conversion_factor:3000,
    }),
  ]);
  assert.equal(view.commercialSummary,'2 kits · preparar 6 pacotes de 1 kg');
});

test('Kit sem coerência entre rótulo comercial e fator NÃO inventa pacotes',()=>{
  for(const [name,grams,factor] of [
    ['Kit 2 pacotes de 1 kg',1500,2000],
    ['Kit 2 pacotes de 1 kg',2000,3000],
    ['Kit 2 pacotes de 1 kg',2000,1000],
  ] as const){
    const [view]=createSeparationDisplayEntries([
      source('invalid','AMENDOIM TORRADO',null,grams,{
        physical_unit_label:'g',commercial_presentation_name:name,
        commercial_quantity:1,commercial_unit_label:'kit',commercial_conversion_factor:factor,
      }),
    ]);
    assert.ok(!view.commercialSummary?.includes('preparar'),name+' '+grams);
  }
});

test('Legado KG/350g mantém a apresentação atual de Amendoim',()=>{
  for(const [quantity,factor,unit,expected] of [
    [3,1000,'kg','3 kg'],
    [2,350,'pacote','2 pacotes de 350 g'],
  ] as const){
    const [view]=createSeparationDisplayEntries([
      source('legacy'+unit,'AMENDOIM TORRADO',null,quantity*factor,{
        physical_unit_label:'g',commercial_quantity:quantity,
        commercial_unit_label:unit,commercial_conversion_factor:factor,
        commercial_presentation_name:unit==='kg'?'kg':'350 g',
      }),
    ]);
    assert.equal(view.commercialSummary,expected);
  }
});
