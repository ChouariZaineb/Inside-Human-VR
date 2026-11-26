import { test, expect } from '@playwright/test';
import { openApp } from './helpers.mjs';

test('biologie : globules, plaquettes et molécules correctes dans les poumons', async ({ page }) => {
  await openApp(page);
  const status = await page.evaluate(async () => {
    window.app.gameState.unlock('lungs');
    await window.app.levels.load('lungs');
    const level = window.app.levels.current;
    const cells = level.capillaryCells;
    const molecules = level.molecules.map(({ group }) => {
      const elements = [];
      group.traverse((o) => { if (o.userData.element) elements.push(o.userData.element); });
      return { formula: group.userData.formula, composition: group.userData.composition, source: group.userData.modelSource, elements };
    });
    return {
      redCells: cells.mesh.count,
      platelets: cells.plateletMesh.count,
      redCellSource: cells.mesh.userData.modelSource,
      plateletSource: cells.plateletMesh.userData.modelSource,
      molecules,
    };
  });
  expect(status.redCells).toBeGreaterThan(0);
  expect(status.platelets).toBeGreaterThan(0);
  expect(status.redCellSource).toBe('blender-glb');
  expect(status.plateletSource).toBe('blender-glb');
  expect(status.molecules).toHaveLength(6);
  for (const molecule of status.molecules) {
    expect(molecule.source).toBe('blender-glb');
    if (molecule.formula === 'O₂') {
      expect(molecule.elements.sort()).toEqual(['O', 'O']);
      expect(molecule.composition).toEqual({ O: 2, C: 0 });
    } else {
      expect(molecule.formula).toBe('CO₂');
      expect(molecule.elements.sort()).toEqual(['C', 'O', 'O']);
      expect(molecule.composition).toEqual({ O: 2, C: 1 });
    }
  }
});
