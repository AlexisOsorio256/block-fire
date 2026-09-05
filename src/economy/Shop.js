// ── Shop — ARSENAL: la tienda del Clash Squad ──
// Dueña de la INTERACCIÓN de compra: abrir/cerrar, comprar arma, equipar.
// El oro (coins) y el inventario (weaponSystem.owned) viven en Game/WeaponSystem
// (fuente única de verdad — aquí solo se consultan y se mutan por operaciones
// de compra). En FFA el arsenal abre libre y todo es gratis; en escuadras la
// compra SOLO existe en la fase de compra (regla Free Fire).
export class Shop {
  constructor(game) { this.g = game; }

  // Toggle (el botón ARSENAL y la apertura automática de ronda pasan por aquí).
  toggleOpen() {
    const g = this.g;
    if (g.shopOpenFlag) { g.hud.closeShop(); g.shopOpenFlag = false; return; }
    // Clash Squad: la compra es ANTES de la ronda (regla Free Fire); en FFA
    // el arsenal abre cuando sea (todo es gratis allí).
    if (g.gameMode === 'squad' && g.phase !== 'buy') return;
    const weapons = g.weaponSystem.weapons.map(k => ({
      key: k,
      name: g.weaponData[k].name,
      price: g.weaponData[k].price || 0,
      owned: g.weaponSystem.owned.has(k),
    }));
    g.hud.showShop({
      weapons,
      onBuyWeapon: (i) => this.buy(i),
      getCoins: () => g.coins,
    });
    g.shopOpenFlag = true;
  }

  buy(i) {
    const g = this.g;
    const key = g.weaponSystem.weapons[i];
    const price = g.weaponData[key].price || 0;
    if (g.weaponSystem.owned.has(key)) {
      // ya es tuya: equiparla (cambio gratis dentro de la fase de compra)
      g.weaponSystem.switchWeapon(i + 1);
      g.hud.refreshShop(g.coins, g.weaponSystem.owned);
      return;
    }
    if (g.coins < price) { g.audio.play('empty'); return; }
    g.coins -= price;
    g.weaponSystem.owned.add(key);
    g.weaponSystem.switchWeapon(i + 1);
    g.audio.play('switch');
    g.hud.refreshShop(g.coins, g.weaponSystem.owned);
  }
}
