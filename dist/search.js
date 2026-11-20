export const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export const TYPES = { ponto_verde: 'Ponto Verde', urpv: 'URPV', galpao: 'Galpão de reciclagem' };
export function distanceKm(a, b) {
  const rad = n => n * Math.PI / 180;
  const dLat = rad(b[1] - a[1]), dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function filterPoints(features, state) {
  const tokens = normalize(state.location).split(' ').filter(Boolean);
  return features.flatMap(feature => {
    const p = feature.properties;
    if (state.kind && p.tipo !== state.kind) return [];
    if (state.region && normalize(p.regional) !== normalize(state.region)) return [];
    if (state.materials.length) {
      const matches = state.materials.map(m => p.materiais_indexados.includes(m));
      if (!(state.mode === 'all' ? matches.every(Boolean) : matches.some(Boolean))) return [];
    }
    const location = normalize([p.nome, p.bairro, p.regional, p.endereco, p.referencia].join(' '));
    if (!tokens.every(t => location.includes(t))) return [];
    const distance = state.position ? distanceKm(state.position, feature.geometry.coordinates) : null;
    if (distance !== null && distance > state.radius) return [];
    return [{ feature, distance }];
  }).sort((a, b) => state.sort === 'distance' && state.position
    ? a.distance - b.distance || a.feature.properties.nome.localeCompare(b.feature.properties.nome, 'pt-BR')
    : a.feature.properties.nome.localeCompare(b.feature.properties.nome, 'pt-BR'));
}

export function nearestPoints(features, state, limit = 5) {
  if (!state.position) return [];

  return filterPoints(features, {
    ...state,
    radius: Number.POSITIVE_INFINITY,
    sort: 'distance'
  }).slice(0, limit);
}
