import { normalize, filterPoints, TYPES } from './search.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const present = value => value || 'Não informado';
const fmtDate = value => value ? new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value).toLocaleDateString('pt-BR', {timeZone:'America/Sao_Paulo'}) : 'Não informada';
const icons = {papel:'▤',plastico:'♧',metal:'▱',vidro:'♙',isopor:'▦',entulho:'▧',poda:'❧',terra:'◒',pneu:'◎',colchao:'▰',madeira:'▥',moveis:'▣',volumosos:'□',carcacas_eletrodomesticos:'▯'};
const state = { materials:[], mode:'any', location:'', region:'', kind:'', position:null, radius:5, sort:'name' };
let features = [], metadata, quality, config, map, markers, positionLayer, radiusLayer, filtered = [], picking = false;
const markerById = new Map(), addressCache = new Map();

async function readJson(url) {
  const response = await fetch(url, {cache:'no-cache'});
  if (!response.ok) throw new Error(`Falha ao carregar ${url} (HTTP ${response.status}).`);
  return response.json();
}

function openDialog(name) {
  const dialog = $(`#${name}-dialog`);
  if (!dialog.open) dialog.showModal();
}
document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => openDialog(button.dataset.open)));
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const r = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close();
  });
});

function nomeExibicao(p) {
  if (p.tipo !== 'ponto_verde' || normalize(p.nome) !== 'ponto verde') {
    return present(p.nome);
  }

  const local = p.referencia || p.bairro || p.endereco;

  return local ? `Ponto Verde · ${local}` : 'Ponto Verde';
}

function materialName(id) { return metadata?.materiais.find(m => m.id === id)?.nome || id; }
function renderMaterials() {
  const query = normalize($('#material-query').value);
  $('#materials').innerHTML = metadata.materiais.filter(m => normalize(m.nome).includes(query)).map(m => `<button type="button" class="material ${m.nome.length > 21 ? 'long' : ''} ${m.quantidade ? '' : 'unavailable'}" data-material="${esc(m.id)}" aria-pressed="${state.materials.includes(m.id)}" title="${m.quantidade} pontos mencionam ${esc(m.nome)}"><span class="material-icon" aria-hidden="true">${icons[m.id] || '♧'}</span><span>${esc(m.nome)}</span><small>${m.quantidade}</small></button>`).join('') || '<p class="helper">Material não encontrado no vocabulário. Consulte o texto original dos pontos.</p>';
}

function locationMessage(message, error = false) {
  $('#location-status').textContent = message;
  $('#location-status').classList.toggle('error', error);
}

function setPosition(coords, label) {
  if (!coords.every(Number.isFinite) || coords[0] < -45 || coords[0] > -42 || coords[1] < -22 || coords[1] > -18) {
    locationMessage('Essa localização está fora do entorno de Belo Horizonte. Escolha uma posição em BH.', true);
    return;
  }
  state.position = coords;
  state.location = '';
  state.sort = 'distance';
  $('#location').value = '';
  $('#sort').value = 'distance';
  $('#sort option[value=distance]').disabled = false;
  $('#radius').disabled = false;
  $('#clear-position').hidden = false;
  $('#address-choices').replaceChildren();
  $('#radius-help').textContent = 'Distância aproximada em linha reta, não pelo trajeto.';
  locationMessage(label);
  if (map) {
    if (positionLayer) positionLayer.remove();
    if (radiusLayer) radiusLayer.remove();
    positionLayer = L.circleMarker([coords[1], coords[0]], {radius:7,color:'#fff',weight:3,fillColor:'#c08931',fillOpacity:1}).addTo(map).bindTooltip('Sua referência de localização');
    radiusLayer = L.circle([coords[1], coords[0]], {radius:state.radius * 1000,color:'#9a8d49',weight:1,dashArray:'5 6',fillOpacity:.035,interactive:false}).addTo(map);
    map.fitBounds(radiusLayer.getBounds(), {padding:[20,20],maxZoom:14});
  }
  render();
}

function clearPosition(shouldRender = true) {
  state.position = null;
  state.sort = 'name';
  $('#sort').value = 'name';
  $('#sort option[value=distance]').disabled = true;
  $('#radius').disabled = true;
  $('#clear-position').hidden = true;
  $('#radius-help').textContent = 'Ative com GPS, endereço localizado ou um ponto no mapa.';
  if (positionLayer) positionLayer.remove();
  if (radiusLayer) radiusLayer.remove();
  positionLayer = radiusLayer = null;
  locationMessage('');
  if (shouldRender) render();
}

function fitMap() {
  if (!map) return;
  const coords = filtered.map(item => [item.feature.geometry.coordinates[1],item.feature.geometry.coordinates[0]]);
  if (state.position) coords.push([state.position[1],state.position[0]]);
  if (coords.length) map.fitBounds(coords, {padding:[48,48],maxZoom:15});
}

function initMap() {
  if (!window.L) {
    $('#map-message').hidden = false;
    $('#map-message').textContent = 'O mapa não carregou. A lista e os filtros continuam disponíveis.';
    return;
  }
  map = L.map('map', {zoomControl:false,scrollWheelZoom:false}).setView([-19.91,-43.97],11);
  L.control.zoom({position:'topright'}).addTo(map);
  const tiles = L.tileLayer(config.tile_url, {maxZoom:19,attribution:config.tile_attribution}).addTo(map);
  let tileFailures = 0;
  tiles.on('tileerror', () => {
    if (++tileFailures >= 3) {
      $('#map-message').hidden = false;
      $('#map-message').textContent = 'O mapa de fundo está indisponível. Os pontos, a lista e os filtros continuam funcionando.';
    }
  });
  tiles.on('tileload', () => {
    tileFailures = 0;
    if (!picking) $('#map-message').hidden = true;
  });
  markers = L.layerGroup().addTo(map);
  map.on('click', event => {
    if (!picking) return;
    setPicking(false);
    setPosition([event.latlng.lng,event.latlng.lat], 'Referência escolhida no mapa.');
  });
}

function setPicking(value) {
  picking = value;
  $('#pick-map').setAttribute('aria-pressed', String(value));
  $('#map-panel').classList.toggle('picking', value);
  $('#map-message').hidden = !value;
  if (value) {
    setView('map');
    $('#map-message').textContent = 'Clique no mapa para escolher sua referência de localização. Clique em “Marcar no mapa” novamente para cancelar.';
    $('#map-panel').scrollIntoView({behavior:'smooth',block:'center'});
  }
}

function updateMarkers() {
  if (!map) return;
  markers.clearLayers();
  markerById.clear();
  filtered.forEach(({feature:f}) => {
    const p = f.properties, [lon,lat] = f.geometry.coordinates;
    const icon = L.divIcon({className:`pin-marker ${p.tipo}`,html:'<span></span>',iconSize:[28,34],iconAnchor:[14,30],popupAnchor:[0,-24]});
    const marker = L.marker([lat,lon], {icon,title:`${TYPES[p.tipo] || p.tipo}: ${nomeExibicao(p)}`,alt:nomeExibicao(p),keyboard:true}).addTo(markers);
    const popup = document.createElement('div');
    const title = document.createElement('strong');
    title.className = 'popup-title'; title.textContent = nomeExibicao(p);
    const address = document.createElement('div'); address.textContent = present(p.endereco);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'popup-button'; button.textContent = 'Ver detalhes e materiais →';
    button.addEventListener('click', () => showDetails(f));
    popup.append(title,address,button); marker.bindPopup(popup);
    markerById.set(p.id,marker);
  });
}

function routeUrl(f) {
  const [lon,lat] = f.geometry.coordinates;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

function render() {
  if (!metadata) return;
  filtered = filterPoints(features,state);
  const n = filtered.length;
  $('#result-count').textContent = `${n} ${n === 1 ? 'ponto encontrado' : 'pontos encontrados'}`;
  $('#list-counter').textContent = n;
  $('#result-context').textContent = state.position ? `Em até ${state.radius} km da sua referência · distância em linha reta` : 'Locais e informações fornecidos pela PBH';
  const active = state.materials.map(id => `<button class="active-chip" type="button" data-remove-material="${esc(id)}" aria-label="Remover filtro ${esc(materialName(id))}">${esc(materialName(id))} ×</button>`);
  if (state.location) active.push(`<span class="active-chip">Local: ${esc(state.location)}</span>`);
  if (state.region) active.push(`<span class="active-chip">${esc(state.region)}</span>`);
  if (state.kind) active.push(`<span class="active-chip">${esc(TYPES[state.kind] || state.kind)}</span>`);
  $('#active-filters').innerHTML = active.join('');
  $('#empty-state').hidden = n !== 0;
  $('#results').innerHTML = filtered.map(({feature:f,distance}) => {
    const p = f.properties;
    const tags = p.materiais_indexados.slice(0,4).map(id => `<span class="tag">${esc(materialName(id))}</span>`).join('');
    const more = p.materiais_indexados.length > 4 ? `<span class="tag">+${p.materiais_indexados.length - 4}</span>` : '';
    return `<article class="point-card" data-card-id="${esc(p.id)}"><div class="card-top"><span class="badge ${esc(p.tipo)}">${esc(TYPES[p.tipo] || p.tipo)}</span>${distance !== null ? `<span class="distance">${distance.toLocaleString('pt-BR',{maximumFractionDigits:1})} km</span>` : `<span class="distance">${esc(p.regional)}</span>`}</div><h4><button type="button" data-detail="${esc(p.id)}">${esc(nomeExibicao(p))}</button></h4><p class="card-address">${esc(p.endereco || 'Endereço não informado')}<br>${esc(p.bairro || 'Bairro não informado')}</p><div class="tags">${tags || '<span class="tag">Material não informado no índice</span>'}${more}</div><div class="card-bottom"><button type="button" data-detail="${esc(p.id)}">Ver detalhes <span aria-hidden="true">↗</span></button><button type="button" data-map="${esc(p.id)}">Ver no mapa ⌖</button></div></article>`;
  }).join('');
  updateMarkers();
}

function showDetails(f) {
  const p = f.properties, coords = f.geometry.coordinates;
  const materials = p.materiais_indexados.map(id => `<span class="tag">${esc(materialName(id))}</span>`).join('');
  $('#detail-content').innerHTML = `<span class="badge ${esc(p.tipo)}">${esc(TYPES[p.tipo] || p.tipo)}</span><h2 id="detail-title">${esc(nomeExibicao(p))}</h2><div class="tags">${materials}</div><dl><dt>Endereço</dt><dd>${esc(present(p.endereco))}</dd><dt>Bairro / regional</dt><dd>${esc(present(p.bairro))} · ${esc(present(p.regional))}</dd><dt>Referência de localização</dt><dd>${esc(present(p.referencia))}</dd><dt>Materiais — texto original da fonte</dt><dd>${esc(present(p.material_original))}</dd><dt>Horário — texto original da fonte</dt><dd>${esc(present(p.horario_original))}</dd><dt>Coordenadas (EPSG:4326)</dt><dd>Latitude: ${coords[1]} · Longitude: ${coords[0]}</dd><dt>Identificador no Descarte BH</dt><dd>${esc(p.id)}</dd></dl><div class="detail-actions"><a class="primary-link" href="${routeUrl(f)}" target="_blank" rel="noopener noreferrer">Abrir rota no Google Maps ↗</a><button type="button" class="outline" id="detail-map">Ver no mapa ⌖</button></div><h3>Origem e metadados do registro</h3>${p.origens.map(o => `<div class="data-source"><h3>${esc(o.nome)}</h3><dl><dt>Arquivo original</dt><dd>${esc(o.arquivo)}</dd><dt>Referência temporal</dt><dd>${fmtDate(o.data_referencia)}</dd><dt>Registro na fonte</dt><dd>${esc(o.id_registro)} · linha ${o.linha}</dd><dt>SHA-256</dt><dd class="hash">${esc(o.sha256)}</dd></dl><a href="${esc(o.url)}" target="_blank" rel="noopener noreferrer">Consultar conjunto oficial ↗</a></div>`).join('')}<p class="metadata-note">Confirme a operação e as condições com a PBH. A descrição é preservada do CSV; ela não comprova recebimento atual. Ausência de um material no índice não significa proibição.</p>`;
  $('#detail-map').addEventListener('click', () => { $('#detail-dialog').close(); focusOnMap(p.id); });
  openDialog('detail');
}

function focusOnMap(id) {
  setView('map');
  const marker = markerById.get(id);
  if (marker && map) {
    map.setView(marker.getLatLng(),16);
    marker.openPopup();
    $('#map-panel').scrollIntoView({behavior:'smooth',block:'center'});
  }
}

function renderMetadata() {
  const rejected = Object.values(quality.rejeicoes).reduce((sum,n) => sum+n,0);
  $('#metadata-content').innerHTML = `<div class="download-links"><a class="outline" href="dados/pontos.geojson" download>GeoJSON ↓</a><a class="outline" href="dados/pontos.csv" download>CSV tratado ↓</a><a class="outline" href="dados/metadados.json" download>Metadados JSON ↓</a><a class="outline" href="dados/relatorio_qualidade.json" download>Relatório de qualidade ↓</a></div><dl><dt>Título</dt><dd>${esc(metadata.titulo)}</dd><dt>Criador / publicador</dt><dd>${esc(metadata.criador)}<br>${esc(metadata.publicador)}</dd><dt>Cobertura / idioma / formato</dt><dd>${esc(metadata.cobertura)} · ${esc(metadata.idioma)} · ${esc(metadata.formato)}</dd><dt>Processado em</dt><dd>${new Date(metadata.processado_em_utc).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} (Brasília)</dd><dt>Referência espacial</dt><dd>${esc(metadata.crs_origem)} → ${esc(metadata.crs_saida)} · ${esc(metadata.ordem_coordenadas)}</dd><dt>Qualidade</dt><dd>${metadata.quantidade_total} pontos publicados · ${rejected} registros rejeitados · ${quality.duplicados_integrados.length} duplicados exatos integrados · ${quality.possiveis_sobreposicoes.length} possíveis sobreposições para revisão</dd></dl><h3>Fontes e versões utilizadas</h3>${metadata.fontes.map(s => `<section class="data-source"><h3>${esc(s.nome)}</h3><dl><dt>Arquivo original</dt><dd>${esc(s.arquivo)}</dd><dt>Data de referência</dt><dd>${fmtDate(s.data_referencia)} (nome original do arquivo)</dd><dt>Data do download</dt><dd>${fmtDate(s.baixado_em)}</dd><dt>URL do recurso</dt><dd>${s.recurso_url ? esc(s.recurso_url) : 'Não informada'}</dd><dt>Licença</dt><dd>${esc(s.licenca)}</dd><dt>Registros</dt><dd>${s.linhas_lidas} lidos · ${s.registros_aproveitados} novos pontos · ${s.duplicados_integrados} duplicados integrados</dd><dt>Esquemas encontrados</dt><dd>${esc(s.esquemas_encontrados.map(k => TYPES[k] || k).join(', '))}</dd><dt>SHA-256</dt><dd class="hash">${esc(s.sha256)}</dd></dl><p>${esc(s.nota)}</p><div class="download-links"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">Conjunto oficial ↗</a><a href="dados/${esc(s.arquivo_bruto_url)}" download="${esc(s.arquivo)}">CSV bruto preservado ↓</a></div><details><summary>Cabeçalhos encontrados</summary><p class="hash">${esc(s.cabecalhos.join(' · '))}</p></details></section>`).join('')}<h3>Dicionário de dados</h3><table class="data-table"><thead><tr><th>Campo</th><th>Significado</th></tr></thead><tbody>${Object.entries(metadata.campos).map(([k,v])=>`<tr><td><code>${esc(k)}</code></td><td>${esc(v)}</td></tr>`).join('')}</tbody></table><h3>Tratamento e limitações</h3><p>${esc(metadata.criterio_indexacao)}</p>${metadata.limitacoes.map(x=>`<p>• ${esc(x)}</p>`).join('')}`;
}

function setView(view) {
  $('.results-area').classList.toggle('view-list', view === 'list');
  document.querySelectorAll('[data-view]').forEach(b => { b.classList.toggle('selected',b.dataset.view===view); b.setAttribute('aria-pressed', String(b.dataset.view===view)); });
  if (view === 'map' && map) requestAnimationFrame(() => map.invalidateSize());
}

function reset() {
  Object.assign(state,{materials:[],mode:'any',location:'',region:'',kind:'',radius:5,sort:'name'});
  HTMLFormElement.prototype.reset.call($('#filter-form'));
  $('#radius-value').textContent = '5 km';
  $('#address-choices').replaceChildren();
  clearPosition(false); setPicking(false); renderMaterials(); render(); fitMap();
}

async function geocode() {
  const query = $('#location').value.trim();
  if (query.length < 3) { locationMessage('Digite um endereço com pelo menos 3 caracteres.',true); return; }
  const button = $('#geocode'); button.disabled = true; button.textContent = 'Localizando…';
  $('#address-choices').replaceChildren();
  locationMessage('Consultando endereço no Photon/OpenStreetMap…');
  try {
    let choices = addressCache.get(query);
    if (!choices) {
      const url = new URL(config.geocoder);
      url.search = new URLSearchParams({q:`${query}, Belo Horizonte, Brasil`,limit:'5',bbox:config.geocoder_bbox.join(','),lat:'-19.92',lon:'-43.94'});
      const response = await fetch(url, {signal:AbortSignal.timeout(12000)});
      if (!response.ok) throw new Error('Serviço de endereços indisponível');
      const data = await response.json();
      choices = (data.features || []).filter(f => f.geometry?.type==='Point' && f.geometry.coordinates[0] >= -44.2 && f.geometry.coordinates[0] <= -43.7 && f.geometry.coordinates[1] >= -20.2 && f.geometry.coordinates[1] <= -19.6);
      addressCache.set(query,choices);
    }
    if ($('#location').value.trim() !== query) return;
    if (!choices.length) { locationMessage('Endereço não localizado. Tente incluir número e bairro ou marque a posição no mapa.',true); return; }
    locationMessage('Escolha o endereço de referência:');
    for (const f of choices) {
      const p = f.properties;
      const label = [...new Set([p.name,p.street,p.housenumber,p.district,p.city,p.state].filter(Boolean))].join(', ');
      const choice = document.createElement('button'); choice.type='button'; choice.textContent=label;
      choice.addEventListener('click',()=>setPosition(f.geometry.coordinates,`Referência: ${label}`));
      $('#address-choices').append(choice);
    }
  } catch {
    if ($('#location').value.trim() === query) locationMessage('Não foi possível consultar o endereço. O filtro por texto continua disponível; você também pode marcar no mapa ou usar o GPS.',true);
  } finally { button.disabled=false; button.innerHTML='Localizar endereço no mapa <span aria-hidden="true">↗</span>'; }
}

function wireEvents() {
  $('#filter-form').addEventListener('submit',event=>{event.preventDefault();geocode();});
  $('#materials').addEventListener('click',event=>{
    const b=event.target.closest('[data-material]'); if(!b)return;
    const id=b.dataset.material;
    state.materials=state.materials.includes(id)?state.materials.filter(m=>m!==id):[...state.materials,id];
    renderMaterials();render();
  });
  $('#active-filters').addEventListener('click',event=>{
    const b=event.target.closest('[data-remove-material]');if(!b)return;
    state.materials=state.materials.filter(m=>m!==b.dataset.removeMaterial);renderMaterials();render();
  });
  $('#material-query').addEventListener('input',renderMaterials);
  $('#location').addEventListener('input',()=>{clearPosition(false);state.location=$('#location').value;$('#address-choices').replaceChildren();render();});
  $('#match-mode').addEventListener('change',event=>{state.mode=event.target.value;render();});
  $('#region').addEventListener('change',event=>{state.region=event.target.value;render();fitMap();});
  $('#kind').addEventListener('change',event=>{state.kind=event.target.value;render();});
  $('#sort').addEventListener('change',event=>{state.sort=event.target.value;render();});
  $('#radius').addEventListener('input',event=>{state.radius=Number(event.target.value);$('#radius-value').textContent=`${state.radius} km`;if(radiusLayer)radiusLayer.setRadius(state.radius*1000);render();});
  $('#reset').addEventListener('click',reset);$('#empty-reset').addEventListener('click',reset);
  $('#fit-map').addEventListener('click',fitMap);$('#clear-position').addEventListener('click',()=>clearPosition());
  $('#pick-map').addEventListener('click',()=>setPicking(!picking));
  $('#geocode').addEventListener('click',geocode);
  $('#geolocate').addEventListener('click',()=>{
    if(!navigator.geolocation){locationMessage('Seu navegador não oferece localização. Marque sua posição no mapa.',true);return;}
    const button=$('#geolocate');button.disabled=true;locationMessage('Aguardando a permissão de localização…');
    navigator.geolocation.getCurrentPosition(position=>{button.disabled=false;setPosition([position.coords.longitude,position.coords.latitude],`Localização atual · precisão estimada ${Math.round(position.coords.accuracy)} m`);},error=>{button.disabled=false;locationMessage(error.code===1?'Permissão de localização negada. Você pode digitar um bairro ou marcar no mapa.':'Não foi possível obter a localização. Digite um bairro ou marque no mapa.',true);},{enableHighAccuracy:true,timeout:15000,maximumAge:60000});
  });
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  $('#results').addEventListener('click',event=>{
    const detail=event.target.closest('[data-detail]'), pin=event.target.closest('[data-map]');
    if(detail){const f=features.find(f=>f.properties.id===detail.dataset.detail);if(f)showDetails(f);}
    if(pin)focusOnMap(pin.dataset.map);
  });
}

async function main() {
  try {
    const [geo,meta,report,settings]=await Promise.all(['dados/pontos.geojson','dados/metadados.json','dados/relatorio_qualidade.json','config.json'].map(readJson));
    if(geo.type!=='FeatureCollection'||!Array.isArray(geo.features))throw new Error('Formato da base inválido.');
    features=geo.features;metadata=meta;quality=report;config=settings;
    $('#total-points').textContent=features.length;
    $('#total-regions').textContent=new Set(features.map(f=>f.properties.regional).filter(Boolean)).size;
    $('#total-sources').textContent=metadata.fontes.length;
    const dates=[...new Set(metadata.fontes.map(s=>fmtDate(s.data_referencia)))];
    $('#reference-date').textContent=`PBH · referência ${dates.join(' / ')}`;
    const regions=[...new Set(features.map(f=>f.properties.regional).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    regions.forEach(r=>$('#region').add(new Option(r,r)));
    [...new Set(features.map(f=>f.properties.tipo))].sort().forEach(k=>$('#kind').add(new Option(TYPES[k]||k,k)));
    const locations=[...new Set(features.flatMap(f=>[f.properties.bairro,f.properties.regional]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    locations.forEach(value=>{const o=document.createElement('option');o.value=value;$('#locations').append(o);});
    renderMaterials();renderMetadata();initMap();wireEvents();render();fitMap();
  } catch(error) {
    $('#error-state').hidden=false;
    $('#error-state').textContent=`Não foi possível carregar a base de dados. ${error.message} Recarregue a página ou consulte os arquivos de dados.`;
    $('#result-count').textContent='Base indisponível';$('#reference-date').textContent='Falha no carregamento';
    $('#filter-form').querySelectorAll('input,select,button').forEach(el=>el.disabled=true);
    console.error(error);
  }
}
main();
