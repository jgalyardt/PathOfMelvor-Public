export class Debug {
  constructor(config, storage) {
    this.config = config;
    this.storage = storage;

    window.p = this;
  }

  runAllTests() {
    this.testSave();
    this.testVanillaUpgrades();
  }

  testSave() {
    console.log("**BEGIN** Testing saves...");
    this.clearBank();

    let bankIDs = [
      "pathOfMelvor:Bronze_Dagger_uncommon_0",
      "pathOfMelvor:Bronze_Dagger_rare_1",
      "pathOfMelvor:Bronze_Dagger_legendary_2"
    ]

    let equipmentIDs = [
      "pathOfMelvor:Bronze_2H_Sword_uncommon_0",
      "pathOfMelvor:Bronze_Helmet_rare_1",
      "pathOfMelvor:Bronze_Boots_legendary_2"
    ]

    bankIDs.forEach(id => {
      game.bank.addItemByID(id, 1, true, true, false);
    });

    equipmentIDs.forEach(id => {
      let newItem = game.items.equipment.registeredObjects.get(id);
      if (newItem) {
        game.combat.player.equipmentSets[0].equipment.equipItem(
          newItem,
          newItem.validSlots[0],
          1
        );
      }
    });
    console.assert(this.storage.saveToCharacterStorage(), `Saves: An error occured while generating/setting the save string.`);

    this.clearBank();
    let itemsArray = this.storage.loadFromCharacterStorage();
    console.assert(Array.isArray(itemsArray), `Saves: Loaded save string was not an array.`);

    this.storage.addItemsToGame(itemsArray);
    const validBank = (function() {
      for (const id of bankIDs) {
        const itemRef = game.items.getObjectByID(id);
        if (!game.bank.items.has(itemRef)) {
          return false;
        }
      }
      return true;
    })();
    console.assert(validBank, `Saves: Items loaded into bank did not match save data`);

    const validEquipment = (function() {
      for (const id of equipmentIDs) {
        const itemRef = game.items.getObjectByID(id);
        if (!game.combat.player.equipmentSets[0].equipment.slotMap.has(itemRef)) {
          return false;
        }
      }
      return true;
    })();
    console.assert(validEquipment, `Saves: Items loaded into equipment did not match save data`);

    this.clearBank();
    console.log("**END** Finished testing saves...");
  }

  testVanillaUpgrades(verbose=false, upgradeQuantity=1, breakpointOnID='') {
    console.log("**BEGIN** Testing vanilla item upgrades...");
    this.clearBank();

    let index = 0;
    for (const upgradeArr of game.bank.itemUpgrades) {
      console.assert(upgradeArr[1][0], `Upgrades: upgrade for ${upgradeArr[0].localID} does not exist.`);
      const upgrade = upgradeArr[1][0];

      if (upgrade && upgrade.rootItems && upgrade.rootItems[0] && upgrade.rootItems[0].localID && upgrade.rootItems[0].namespace) {

        if (upgrade.rootItems[0].localID === breakpointOnID) {
          debugger;
        }

        if (upgrade.rootItems[0].namespace === 'pathOfMelvor') {
          continue;
        }
        else if (verbose) {
          console.log(`Upgrades: Testing ${upgrade.rootItems[0].namespace}:${upgrade.rootItems[0].localID}`);
        }
      }

      console.assert(upgrade.itemCosts, `Upgrades: Item costs at ${index} does not exist.`);
      console.assert(this.isValidNumber(upgrade.gpCost), `Upgrades: gpCost for ${upgradeArr[0].localID} is not a valid number.`);
      console.assert(this.isValidNumber(upgrade.scCost), `Upgrades: scCost for ${upgradeArr[0].localID} is not a valid number.`);
      
      upgrade.itemCosts.forEach(itemCost => {
        console.assert(itemCost.item.localID, `Upgrades: itemCost.item.localID is undefined.`);
        console.assert(this.isValidItem(itemCost.item), `Upgrades: itemCost.item.localID "${itemCost.item.localID}" is not a valid item.`);
      });

      this.testUpgradeItemOnClick(upgrade, upgradeQuantity);

      index += 1;
    }
    console.log("**END** Finished testing item upgrades.");
  }

  testUpgradeItemOnClick(upgrade, upgradeQuantity) {
    const expectedResultArray = this.getValidItemVariants(upgrade.upgradedItem);
    game.gp.add(upgrade.gpCost * upgradeQuantity);
    upgrade.itemCosts.forEach(itemCost => {
      game.bank.addItemByID(`${itemCost.item.namespace}:${itemCost.item.localID}`, itemCost.quantity * upgradeQuantity, true, true, false);
    });

    game.bank.upgradeItemOnClick(upgrade, upgradeQuantity);

    const expectedResultFound = (function() {
      for (const possibleResult of expectedResultArray) {
        const itemRef = game.items.getObjectByID(possibleResult);
        if (!game.bank.items.has(itemRef)) {
          return false;
        }
      }
      return true;
    })();
    
    console.assert(expectedResultFound, `Upgrades: Expected result for "${upgrade.rootItems[0].localID}" not found in bank items.`);

    this.clearBank();
  }

  isValidItem(item) {
    return game.items.getObjectByID(`${item.namespace}:${item.localID}`);
  }

  isValidNumber(n) {
    return typeof n === 'number' && !isNaN(n) && n >= 0;
  }

  getValidItemVariants(item) {
    let results = [];

    results.push(`${item.namespace}:${item.localID}`);
    if (item && item.namespace && item.namespace !== 'pathOfMelvor'
      && game.items.equipment.registeredObjects.has(`pathOfMelvor:${item.localID}_uncommon_0`)) {
      this.config.rarities.forEach(rarity => {
        for (let i = 0; i < rarity.amountToGenerate; i++) {
          results.push(`pathOfMelvor:${item.localID}_${rarity.name}_${i}`); 
        }
      });
    }

    return results;
  }

  clearBank() {
    game.bank.items.forEach(bankItem => {
      let item = bankItem.item;
      let quantity = bankItem.quantity;
      game.bank.removeItemQuantity(item, quantity);
    });
  }

  addItem(id, quantity=1) {
    game.bank.addItemByID(id, quantity, true, true, true);
  }

  generateDebugItems = () => {
    game.bank.addItem(game.items.weapons.registeredObjects.get('melvorD:Bronze_Dagger'), 1, true, true, true, false, 'pathOfMelvor');
    game.bank.addItem(game.items.equipment.registeredObjects.get('pathOfMelvor:Bronze_Helmet_rare_0'), 1, true, true, true, false, 'pathOfMelvor');
    game.bank.addItem(game.items.weapons.registeredObjects.get('pathOfMelvor:Bronze_Dagger_legendary_0'), 1, true, true, true, false, 'pathOfMelvor');
    game.bank.addItemByID("melvorF:Scroll_of_Ragnar", 100, true, true, false);
    game.bank.addItemByID("melvorF:Shockwave_Fragment", 100, true, true, false);
    game.bank.addItemByID("melvorD:Bronze_Bar", 100, true, true, false);
    game.bank.addItemByID("melvorD:Silver_Bar", 100, true, true, false);
  }
}