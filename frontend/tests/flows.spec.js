import { test, expect } from '@playwright/test';

const password = process.env.E2E_PASSWORD;
if (!password) throw new Error('Definí E2E_PASSWORD y ejecutá preparar_e2e antes de estas pruebas.');

async function login(page) {
  await page.goto('/login');
  await page.getByLabel('Usuario', { exact: true }).fill('pruebas');
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Tablero de temas' })).toBeVisible();
  await expect(page.getByLabel('Columna Nuevo')).toBeVisible();
}
async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
}

test('desktop: alta, edición, comentario, historial y Mis temas', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page);
  await page.getByRole('button', { name: 'Nuevo tema', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Nuevo tema' })).toBeVisible();
  await page.getByLabel('Título', { exact: false }).fill('Tema E2E de escritorio');
  await page.getByLabel('Tipo de tema').selectOption({ label: 'Problema' });
  await page.getByLabel('Área de origen', { exact: false }).last().selectOption({ label: 'Enfermería' });
  await page.getByRole('combobox', { name: 'Responsable', exact: true }).last().selectOption({ label: 'Alexis Guantay' });
  await page.getByRole('checkbox', { name: 'Sistemas', exact: true }).check();
  await page.getByRole('radio', { name: 'Alta', exact: true }).check();
  await page.getByLabel('Descripción', { exact: false }).fill('Descripción completa de la prueba institucional.');
  await page.getByRole('textbox', { name: 'Impacto', exact: true }).fill('Impacto descriptivo separado de la prioridad.');
  await page.getByRole('button', { name: 'Crear tema', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tema E2E de escritorio', exact: true, level: 1 })).toBeVisible();
  await page.getByLabel('Comentario', { exact: true }).fill('Seguimiento escrito por el usuario autenticado.');
  await page.getByRole('button', { name: 'Comentar', exact: true }).click();
  await expect(page.getByText('Seguimiento escrito por el usuario autenticado.')).toBeVisible();
  await page.getByRole('button', { name: 'Editar tema' }).click();
  await page.getByRole('textbox', { name: 'Impacto', exact: true }).fill('Impacto revisado en reunión.');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Impacto revisado en reunión.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cambiar estado', exact: true }).click();
  await page.getByRole('combobox', { name: 'Nuevo estado', exact: true }).selectOption({ label: 'En curso' });
  await page.getByRole('button', { name: 'Confirmar estado' }).click();
  await page.getByRole('tab', { name: 'Actividad', exact: true }).click();
  await expect(page.getByText('Cambió estado.')).toBeVisible();
  await expect(page.getByText('Cambió impacto.')).toBeVisible();
  await page.screenshot({ path: 'test-results/detalle-escritorio.png', fullPage: false });
  await page.getByRole('button', { name: 'Cerrar ventana' }).click();
  await page.getByRole('link', { name: 'Mis temas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mis temas', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Tema E2E de escritorio/ })).toBeVisible();
  await expect(page.getByText('Mejora resuelta de prueba 1', { exact: true })).toHaveCount(0);
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('desktop: arrastrar cambia estado y resueltos muestran cinco', async ({ page }) => {
  await login(page);
  const resolved = page.getByLabel('Columna Resuelto');
  await expect(resolved.locator('.topic-card')).toHaveCount(5);
  const card = page.getByRole('button', { name: /Abrir tema .*Falta de stock de insumos/ });
  const source = await card.boundingBox();
  const target = await page.getByLabel('Columna En curso').boundingBox();
  await page.mouse.move(source.x + 70, source.y + 35);
  await page.mouse.down();
  await page.mouse.move(source.x + 100, source.y + 45, { steps: 8 });
  await page.mouse.move(target.x + target.width / 2, target.y + 70, { steps: 20 });
  await page.mouse.up();
  await expect(page.getByLabel('Columna En curso').getByText('Falta de stock de insumos', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: /Ver todos los temas resueltos/ }).click();
  await expect(page.getByRole('heading', { name: 'Temas resueltos', exact: true })).toBeVisible();
  await expect(page.locator('.list-row')).toHaveCount(7);
});

test('móvil: página completa, formulario y estado sin drag', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, baseURL: 'http://127.0.0.1:3000' });
  const page = await context.newPage();
  await login(page);
  await page.getByRole('button', { name: /Abrir tema .*Demoras en internación/ }).tap();
  await expect(page).toHaveURL(/\/temas\/\d+$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Impacto', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cambiar estado', exact: true }).click();
  await page.getByRole('combobox', { name: 'Nuevo estado', exact: true }).selectOption({ label: 'En curso' });
  await page.getByRole('button', { name: 'Confirmar estado' }).click();
  await expect(page.locator('.detail-toolbar .status')).toHaveText('En curso');
  await page.screenshot({ path: 'test-results/detalle-movil.png', fullPage: true });
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo tema', exact: true }).click();
  await expect(page).toHaveURL('/temas/nuevo');
  await page.getByLabel('Título', { exact: false }).fill('Tema E2E móvil');
  await page.getByLabel('Tipo de tema').selectOption({ label: 'Tema Informativo' });
  await page.getByLabel('Área de origen', { exact: false }).selectOption({ label: 'Sistemas' });
  await page.getByLabel('Descripción', { exact: false }).fill('Prueba de alta desde un teléfono.');
  await noOverflow(page);
  await page.screenshot({ path: 'test-results/formulario-movil.png', fullPage: true });
  await page.getByRole('button', { name: 'Crear tema', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tema E2E móvil', exact: true })).toBeVisible();
  await noOverflow(page);
  await context.close();
});

for (const [width, height] of [[1920, 1080], [1366, 768], [820, 1180], [320, 740]]) {
  test(`responsive ${width}x${height}: tablero, formulario y detalle`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await login(page);
    await noOverflow(page);
    await page.screenshot({ path: `test-results/tablero-${width}.png`, fullPage: width < 1024 });
    await page.getByRole('button', { name: 'Nuevo tema', exact: true }).click();
    await expect(page.getByLabel('Título', { exact: false })).toBeVisible();
    await noOverflow(page);
    await page.screenshot({ path: `test-results/formulario-${width}.png`, fullPage: width < 1024 });
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('button', { name: /Abrir tema .*Error de acceso a Innova/ }).click();
    await expect(page.getByRole('heading', { name: 'Error de acceso a Innova', exact: true, level: 1 })).toBeVisible();
    await noOverflow(page);
  });
}

test('contraseña, logout y nuevo login', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: /Mi perfil/ }).click();
  const newPassword = password + '-cambiada';
  await page.getByLabel('Contraseña actual', { exact: true }).fill(password);
  await page.getByLabel('Nueva contraseña', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirmar nueva contraseña', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Actualizar contraseña' }).click();
  await expect(page.getByText('Contraseña actualizada correctamente.')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page).toHaveURL('/login');
  await page.getByLabel('Usuario', { exact: true }).fill('pruebas');
  await page.getByLabel('Contraseña', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Tablero de temas' })).toBeVisible();
  // Restaurar la clave del fixture para permitir nuevas ejecuciones aisladas.
  await page.getByRole('link', { name: /Mi perfil/ }).click();
  await page.getByLabel('Contraseña actual', { exact: true }).fill(newPassword);
  await page.getByLabel('Nueva contraseña', { exact: true }).fill(password);
  await page.getByLabel('Confirmar nueva contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Actualizar contraseña' }).click();
  await expect(page.getByText('Contraseña actualizada correctamente.')).toBeVisible();
});
