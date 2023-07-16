export class MonsterEditor {
  /**
   * Constructor for the MonsterEditor class.
   * @param {Object} manifest - The manifest object containing namespace information.
   * @param {Object} config - The config object containing information about rarities.
   */
  constructor(manifest, config) {
    this.manifest = manifest;
    this.config = config;
  }

  /**
   * Adds an item to the loot table.
   * @param {Object} drop - The drop object containing information about the item drop.
   * @param {Object} rarity - The rarity object containing information about item rarity.
   * @param {number} index - The index used to fetch items with the appropriate index appended to their names.
   * @returns {Object|null} - The new item to add to the loot table, or null if the item does not exist.
   */
  addItemToLootTable(drop, rarity, index) {
    const key = `${this.manifest.namespace}:${drop.item.localID}_${rarity.name}_${index}`;

    if (game.items.equipment.registeredObjects.has(key)) {
      const newItem = game.items.equipment.registeredObjects.get(key);
      // Divide the weight by the amount to generate for that rarity
      const newWeight = Math.ceil((drop.weight * (rarity.weight / 100)) / rarity.amountToGenerate);
      return {
        item: newItem,
        maxQuantity: drop.maxQuantity,
        minQuantity: drop.minQuantity,
        weight: newWeight
      };
    }
    return null;
  }

  /**
 * Processes a single drop and returns the modded items to add to the loot table.
 * @param {Object} drop - The drop object containing information about the item drop.
 * @param {Object[]} rarities - An array of rarity objects containing information about item rarities.
 * @returns {Object} - An object containing the modded items to add and the additional weight.
 */
  processDrop(drop, rarities) {
    const itemsToAdd = [];
    let additionalWeight = 0;

    drop.weight *= 100;
    additionalWeight += drop.weight;

    //Check that this item isn't a chest, which will be handled seperately
    if (drop.item && !drop.item.lootTable) {
      rarities.forEach(rarity => {
        let rarityWeight = 0;
        for (let i = 0; i < rarity.amountToGenerate; i++) {
          const newItem = this.addItemToLootTable(drop, rarity, i);
          if (newItem) {
            itemsToAdd.push(newItem);
            rarityWeight += newItem.weight;
          }
        }
        additionalWeight += rarityWeight;
      });
    }
    return { itemsToAdd, additionalWeight };
  }

  /**
   * Loops through all monsters and adds modded items to their drop tables.
   */
  addModdedItemsToDropTables(includeChests=true, includeThieving=true) {
    game.monsters.registeredObjects.forEach(monster => {
      // Process each drop and accumulate modded items to add
      const allItemsToAdd = monster.lootTable.drops.map(drop => this.processDrop(drop, this.config.rarities)).reduce((acc, val) => {
        acc.itemsToAdd.push(...val.itemsToAdd);
        acc.newTotalWeight += val.additionalWeight;
        return acc;
      }, { itemsToAdd: [], newTotalWeight: 0 });

      // Add new items to the monster's lootTable
      monster.lootTable.drops.push(...allItemsToAdd.itemsToAdd);

      // Update the totalWeight property
      monster.lootTable.totalWeight = allItemsToAdd.newTotalWeight;
    });

    if (includeChests) {
      game.items.openables.registeredObjects.forEach(chest => {
          const allItemsToAdd = chest.dropTable.drops.map(drop => this.processDrop(drop, this.config.rarities)).reduce((acc, val) => {
            acc.itemsToAdd.push(...val.itemsToAdd);
            acc.newTotalWeight += val.additionalWeight;
            return acc;
          }, { itemsToAdd: [], newTotalWeight: 0 });
  
          chest.dropTable.drops.push(...allItemsToAdd.itemsToAdd);
          chest.dropTable.totalWeight = allItemsToAdd.newTotalWeight;
        
      });
    }
  
    if (includeThieving) {
      game.thieving.areas.registeredObjects.forEach(area => {
        area.npcs.forEach(npc => {
          const allItemsToAdd = npc.lootTable.drops.map(drop => this.processDrop(drop, this.config.rarities)).reduce((acc, val) => {
            acc.itemsToAdd.push(...val.itemsToAdd);
            acc.newTotalWeight += val.additionalWeight;
            return acc;
          }, { itemsToAdd: [], newTotalWeight: 0 });
  
          npc.lootTable.drops.push(...allItemsToAdd.itemsToAdd);
          npc.lootTable.totalWeight = allItemsToAdd.newTotalWeight;
        });
      });
    }
  }
}
