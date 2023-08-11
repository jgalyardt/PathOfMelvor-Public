export class Patches {
  constructor(patchFn, randomUtils, storage) {
    this.patch = patchFn;
    this.randomUtils = randomUtils;
    this.storage = storage;
  }

  applyPatches() {
    this.patchSaveString();
    this.patchViewItemContents();
    this.patchUnequip();
    this.patchMonsterDropMenu();
    this.patchShowNpcDrops();
    this.patchUpgradeRecipes();
    this.patchCraftingRewards();
    this.patchSmithingRewards();
    this.patchFletchingRewards();
    this.patchRunecraftingRewards();
  }
  
  //Patch game save function to include custom mod save
  patchSaveString() {
    this.patch(Game, 'generateSaveString').before(() => {
      this.storage.saveToCharacterStorage();
    });
  }
        
  //Patch consumable/chest loot menu to merge the item variants
  patchViewItemContents() {
    let oldViewItemContents = viewItemContents;
    viewItemContents = function (item) {
      let newItem = { ...item }; // Create a shallow copy of the item object
      newItem.dropTable = { ...item.dropTable }; // Create a shallow copy of the dropTable object
      let uniqueItems = {};

      newItem.dropTable.drops = newItem.dropTable.drops.filter((drop) => {
        if (drop.item && drop.item.name && !uniqueItems[drop.item.name]) {
          uniqueItems[drop.item.name] = true;
          return true;
        }
        return false;
      });

      // Sort the drops array by weight in descending order
      newItem.dropTable.sortedDropsArray = newItem.dropTable.drops.sort((a, b) => b.weight - a.weight);

      return oldViewItemContents(newItem);
    }
  }

  //Patch unequip to better handle edge cases introduced by mod
  patchUnequip() {
    this.patch(Player, 'unequipItem').before((set, slot) => {
      const itemToAdd = game.combat.player.equipment.getItemsAddedOnUnequip(slot);
      if (itemToAdd && itemToAdd.item && itemToAdd.item.localID === 'Empty_Equipment') {
        return [set, slot];
      }
  
      const rootSlot = game.combat.player.equipment.getRootSlot(slot);
      const unequipSlot = game.combat.player.equipment.slots[rootSlot];
  
      if (unequipSlot && (isNaN(unequipSlot.quantity) || typeof unequipSlot.quantity !== 'number' || unequipSlot.quantity <= 0)) {
        unequipSlot.quantity = 1;
      }
  
      return [set, slot];
    });
  }

  //Patch monster drop menu to merge item variants with the same name
  patchMonsterDropMenu() {
    this.patch(CombatManager, 'getMonsterDropsHTML').before((monster, respectArea) => {
      let newMonster = { ...monster }; // Create a shallow copy of the monster object
      newMonster.lootTable = { ...newMonster.lootTable }; // Create a shallow copy of the lootTable object
      let uniqueItems = [];
  
      //Remove drops from the table with the same name
      newMonster.lootTable.drops = newMonster.lootTable.drops.filter((drop) => {
        if (drop.item && drop.item.name && !uniqueItems.includes(drop.item.name)) {
          uniqueItems.push(drop.item.name);
          return true;
        }
        return false;
      });
  
      if (newMonster.lootTable && newMonster.lootTable.drops && newMonster.lootTable.drops.length) {
        newMonster.lootTable.size = newMonster.lootTable.drops.length;
      }
  
      // Sort the drops array by weight in descending order
      newMonster.lootTable.sortedDropsArray = newMonster.lootTable.drops.sort((a, b) => b.weight - a.weight);
  
      return [newMonster, respectArea];
    });
  }

  //Patch thieving NPC loot menu to merge item variants with the same name
  patchShowNpcDrops() {
    this.patch(ThievingMenu, 'showNPCDrops').before((npc, area) => {
      let newNpc = { ...npc }; // Create a shallow copy of the npc object
      newNpc.lootTable = { ...npc.lootTable }; // Create a shallow copy of the lootTable object
      let uniqueItems = {};
  
      //Remove drops from the table with the same name
      newNpc.lootTable.drops = newNpc.lootTable.drops.filter((drop) => {
        if (drop.item && drop.item.name && !uniqueItems[drop.item.name]) {
          uniqueItems[drop.item.name] = true;
          return true;
        }
        return false;
      });
  
      // Sort the drops array by weight in descending order
      newNpc.lootTable.sortedDropsArray = newNpc.lootTable.drops.sort((a, b) => b.weight - a.weight);
  
      return [newNpc, area];
    });
  }

  //Patch item upgrade recipes to included modded items
  patchUpgradeRecipes() {
    this.patch(Bank, 'upgradeItemOnClick').before((upgrade, upgradeQuantity) => {
      //Check if this item has modded variants
      if (upgrade && upgrade.upgradedItem && this.randomUtils.checkIfItemHasVariants(upgrade.upgradedItem)) {

        // If upgradeQuantity is greater than 1, iteratively call upgradeItemOnClick for each quantity except the first
        if (upgradeQuantity > 1) {
          // Store the original upgradedItem
          const originalUpgradedItem = upgrade.upgradedItem;

          // Iterate and call upgradeItemOnClick for each quantity above 1
          for (let i = 1; i <= upgradeQuantity - 1; i++) {
            // Reset the upgradedItem to its original value for each iteration
            upgrade.upgradedItem = originalUpgradedItem;

            // Call upgradeItemOnClick with upgradeQuantity set to 1
            game.bank.upgradeItemOnClick(upgrade, 1);
          }

          //Set the original call to 1
          upgradeQuantity = 1;
        }

        // The rest of the original logic, for when upgradeQuantity is 1
        if (upgradeQuantity === 1 && upgrade && upgrade.upgradedItem &&
          upgrade.upgradedItem.validSlots && upgrade.upgradedItem.validSlots[0] &&
          (upgrade.upgradedItem.validSlots[0] === 'Weapon' ||
            upgrade.upgradedItem.validSlots[0] === 'Boots' ||
            upgrade.upgradedItem.validSlots[0] === 'Gloves' ||
            upgrade.upgradedItem.validSlots[0] === 'Helmet' ||
            upgrade.upgradedItem.validSlots[0] === 'Platebody' ||
            upgrade.upgradedItem.validSlots[0] === 'Platelegs' ||
            upgrade.upgradedItem.validSlots[0] === 'Shield')) {

          let selectedVariant = this.randomUtils.getRandomVariant(upgrade.upgradedItem);
          upgrade.upgradedItem = game.items.equipment.registeredObjects.get(selectedVariant);
        }
      }

      return [upgrade, upgradeQuantity];
    });
  }

  //Patch in-game skills that can produce modded items
  patchCraftingRewards() {
    this.patch(Crafting, 'actionRewards').replace((o) => {
      return this.randomUtils.rerollSkillProduct(o, game.crafting);
    });
  }

  patchFletchingRewards() {
    this.patch(Fletching, 'actionRewards').replace((o) => {
      return this.randomUtils.rerollSkillProduct(o, game.fletching);
    });
  }

  patchSmithingRewards() {
    this.patch(Smithing, 'actionRewards').replace((o) => {
      return this.randomUtils.rerollSkillProduct(o, game.smithing);
    });
  }

  patchRunecraftingRewards() {
    this.patch(Runecrafting, 'actionRewards').replace((o) => {
      return this.randomUtils.rerollSkillProduct(o, game.runecrafting);
    });
  }
}