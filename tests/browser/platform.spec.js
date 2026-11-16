import {test,expect} from '@playwright/test';

test('dados reais, filtros combinados, detalhes, mapa e metadados',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#result-count')).toHaveText('86 pontos encontrados');
  await expect(page.locator('.point-card')).toHaveCount(86);
  await expect(page.locator('.pin-marker')).toHaveCount(86);
  await page.getByRole('button',{name:'Entulho',exact:false}).first().click();
  await page.locator('#region').selectOption('PAMPULHA');
  await page.locator('#kind').selectOption('urpv');
  const n=await page.locator('.point-card').count();expect(n).toBeGreaterThan(0);expect(n).toBeLessThan(35);
  await expect(page.locator('.pin-marker')).toHaveCount(n);
  await page.locator('[data-detail]').first().click();
  await expect(page.locator('#detail-dialog')).toBeVisible();
  await expect(page.locator('#detail-content')).toContainText('SHA-256');
  await expect(page.locator('#detail-content')).toContainText('20261103_unidade_recebimento_pequenos_volumes.csv');
  await page.locator('#detail-dialog .close-dialog').click();
  await page.locator('#reset').click();
  await page.locator('#location').fill('bairro xyz inexistente');
  await expect(page.locator('#empty-state')).toBeVisible();
  await expect(page.locator('.pin-marker')).toHaveCount(0);
  await page.locator('#empty-reset').click();
  await expect(page.locator('.point-card')).toHaveCount(86);
  await page.getByRole('button',{name:'Dados e transparência',exact:true}).click();
  await expect(page.locator('#metadata-content')).toContainText('EPSG:31983');
  await expect(page.locator('#metadata-content')).toContainText('Não informada');
  expect(errors).toEqual([]);
});

test('proximidade por GPS e raio',async({page,context})=>{
  await context.grantPermissions(['geolocation']);await context.setGeolocation({latitude:-19.875,longitude:-43.96});
  await page.goto('/');await expect(page.locator('.point-card')).toHaveCount(86);
  await page.locator('#geolocate').click();
  await expect(page.locator('#location-status')).toContainText('Localização atual');
  await expect(page.locator('#radius')).toBeEnabled();await expect(page.locator('#sort')).toHaveValue('distance');
  expect(await page.locator('.point-card').count()).toBeLessThan(86);
  await page.locator('#radius').fill('1');
  await expect(page.locator('#radius-value')).toHaveText('1 km');
  await page.locator('#clear-position').click();await expect(page.locator('.point-card')).toHaveCount(86);
});

test('busca de endereço seleciona posição e não inventa geocodificação',async({page})=>{
  await page.route('https://photon.komoot.io/**',route=>route.fulfill({json:{features:[{type:'Feature',geometry:{type:'Point',coordinates:[-43.96,-19.875]},properties:{name:'Rua de teste',city:'Belo Horizonte'}}]}}));
  await page.goto('/');await expect(page.locator('.point-card')).toHaveCount(86);
  await page.locator('#location').fill('Rua de teste');await page.locator('#geocode').click();
  await page.locator('#address-choices button').first().click();
  await expect(page.locator('#location-status')).toContainText('Rua de teste');
  await expect(page.locator('#radius')).toBeEnabled();await expect(page.locator('#location')).toHaveValue('');
});

test('marcação no mapa ativa proximidade',async({page})=>{
  await page.goto('/');await expect(page.locator('.point-card')).toHaveCount(86);
  await page.locator('#pick-map').click();await expect(page.locator('#pick-map')).toHaveAttribute('aria-pressed','true');
  await page.locator('#map').click({position:{x:180,y:220}});
  await expect(page.locator('#location-status')).toContainText('Referência escolhida no mapa');
  await expect(page.locator('#radius')).toBeEnabled();
});

test('falha no geocodificador mantém filtro textual e apresenta alternativa',async({page})=>{
  await page.route('https://photon.komoot.io/**',route=>route.abort());
  await page.goto('/');await expect(page.locator('.point-card')).toHaveCount(86);
  await page.locator('#location').fill('Pampulha');await page.locator('#geocode').click();
  await expect(page.locator('#location-status')).toContainText('Não foi possível consultar');
  expect(await page.locator('.point-card').count()).toBeGreaterThan(0);await expect(page.locator('#radius')).toBeDisabled();
});

test('falha de dados é explícita',async({page})=>{
  await page.route('**/dados/pontos.geojson',route=>route.fulfill({status:503,body:'offline'}));
  await page.goto('/');await expect(page.locator('#error-state')).toBeVisible();
  await expect(page.locator('#result-count')).toHaveText('Base indisponível');
});

test('celular sem rolagem horizontal e navegação de detalhes',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.locator('.point-card')).toHaveCount(86);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.locator('[data-view=list]').click();await expect(page.locator('#map-panel')).not.toBeVisible();
  await page.locator('[data-detail]').first().click();await expect(page.locator('#detail-dialog')).toBeVisible();
  await page.screenshot({path:'test-results/mobile.png',fullPage:true});
});

test('captura da plataforma',async({page})=>{
  await page.goto('/');await expect(page.locator('.pin-marker')).toHaveCount(86);
  await page.waitForTimeout(1800);await page.screenshot({path:'test-results/desktop.png',fullPage:false});
});
