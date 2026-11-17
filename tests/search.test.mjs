import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalize,filterPoints,distanceKm,nearestPoints} from '../dist/search.js';
const geo=JSON.parse(readFileSync(new URL('../dist/dados/pontos.geojson',import.meta.url)));
const base={materials:[],mode:'any',location:'',region:'',kind:'',position:null,radius:5,sort:'name'};
test('normalização de acentos e espaços',()=>assert.equal(normalize('  São   JOSÉ '),'sao jose'));
test('todos os pontos reais carregam e possuem ids únicos',()=>{
  assert.equal(filterPoints(geo.features,base).length,86);
  assert.equal(new Set(geo.features.map(f=>f.properties.id)).size,geo.features.length);
});
test('papel corresponde somente a menção explícita, nunca a URPV por inferência',()=>{
  const result=filterPoints(geo.features,{...base,materials:['papel']});
  assert.ok(result.length>0);assert.ok(result.every(r=>r.feature.properties.materiais_indexados.includes('papel')));
  assert.ok(result.every(r=>r.feature.properties.tipo==='ponto_verde'));
});
test('localização normaliza acentos, combina tokens e restringe a regional',()=>{
  const results=filterPoints(geo.features,{...base,location:'sao jose',region:'pampulha'});
  assert.ok(results.length);assert.ok(results.every(r=>normalize(r.feature.properties.regional)==='pampulha'));
});
test('material + regional + tipo são aplicados conjuntamente',()=>{
  const result=filterPoints(geo.features,{...base,materials:['entulho'],region:'PAMPULHA',kind:'urpv'});
  assert.ok(result.length);assert.ok(result.every(r=>r.feature.properties.tipo==='urpv'&&r.feature.properties.regional==='PAMPULHA'));
});
test('qualquer um difere de todos os materiais',()=>{
  const any=filterPoints(geo.features,{...base,materials:['papel','entulho']});
  const all=filterPoints(geo.features,{...base,materials:['papel','entulho'],mode:'all'});
  assert.ok(any.length>all.length);assert.ok(all.every(r=>r.feature.properties.materiais_indexados.includes('papel')&&r.feature.properties.materiais_indexados.includes('entulho')));
});
test('proximidade usa coordenadas e ordenação por distância',()=>{
  const position=geo.features[0].geometry.coordinates;
  const result=filterPoints(geo.features,{...base,position,radius:2,sort:'distance'});
  assert.ok(result.length);assert.equal(result[0].distance,0);assert.ok(result.every(r=>r.distance<=2));
  assert.ok(result.every((r,i)=>!i||result[i-1].distance<=r.distance));
  assert.ok(Math.abs(distanceKm([0,0],[0,1])-111.195)<0.01);
});
test('consulta inexistente resulta em lista vazia',()=>assert.equal(filterPoints(geo.features,{...base,location:'bairro inexistente xyz'}).length,0));

test('busca retorna pontos próximos fora do raio e respeita materiais', () => {
  const pontos = [
    {
      properties: {
        id: 'proximo',
        nome: 'Ponto A',
        tipo: 'ponto_verde',
        materiais_indexados: ['papel']
      },
      geometry: {
        coordinates: [-43.94, -19.93]
      }
    },
    {
      properties: {
        id: 'outro_material',
        nome: 'Ponto B',
        tipo: 'urpv',
        materiais_indexados: ['entulho']
      },
      geometry: {
        coordinates: [-43.94, -19.925]
      }
    },
    {
      properties: {
        id: 'distante',
        nome: 'Ponto C',
        tipo: 'ponto_verde',
        materiais_indexados: ['papel']
      },
      geometry: {
        coordinates: [-43.94, -19.94]
      }
    }
  ];

  const estado = {
    ...base,
    materials: ['papel'],
    location: 'Rua inexistente 999',
    position: [-43.94, -19.92],
    radius: 0.1
  };

  // Não existem pontos com papel dentro de 100 metros.
  const dentroRaio = filterPoints(pontos, {
    ...estado,
    location: ''
  });

  assert.equal(dentroRaio.length, 0);

  // A busca complementar ignora o raio e retorna os mais próximos.
  const proximos = nearestPoints(pontos, estado, 2);

  assert.equal(proximos.length, 2);

  // Os pontos aparecem em ordem crescente de distância.
  assert.deepEqual(
    proximos.map(item => item.feature.properties.id),
    ['proximo', 'distante']
  );

  // Todos os pontos sugeridos estão fora do raio inicial.
  assert.ok(
    proximos.every(item => item.distance > estado.radius)
  );

  // Nenhum resultado possui material diferente do solicitado.
  assert.ok(
    proximos.every(item =>
      item.feature.properties.materiais_indexados.includes('papel')
    )
  );
});