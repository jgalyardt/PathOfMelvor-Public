export class ItemPackageBuilder {
  /**
   * Constructs an ItemPackageBuilder instance.
   * @param {object} manifest - The game manifest.
   * @param {object} config - The game configuration.
   * @param {object} itemEditor - The item editor.
   */
  constructor(manifest, config, itemEditor) {
    this.manifest = manifest;
    this.config = config;
    this.itemEditor = itemEditor;
    this.itemUpgrades = [];
  }

  /**
 * Adds upgrade recipes based on the vanilla upgrades
 */
  addUpgradeRecipes() {
    if (game && game.bank && game.bank.itemUpgrades) {
      const vanillaItemUpgrades = game.bank.itemUpgrades;
      let itemUpgradeData = [];

      vanillaItemUpgrades.forEach(recipeArray => {
        let recipe = recipeArray[0];
        this.config.rarities.forEach(rarity => {
          if (recipe
            && recipe.rootItems
            && recipe.rootItems[0]
            && recipe.rootItems[0].localID
            && recipe.rootItems[0].name
            && recipe.rootItems[0].namespace
            && recipe.upgradedItem
            && recipe.upgradedItem.localID) {

            let index = 0;
            let baseItemKey = `${this.manifest.namespace}:${recipe.rootItems[0].localID}_${rarity.name}_${index}`;
            let upgradedItemKey = `${this.manifest.namespace}:${recipe.upgradedItem.localID}_${rarity.name}_${index}`;
  
            while (game.items.equipment.registeredObjects.has(baseItemKey)
              && game.items.equipment.registeredObjects.has(upgradedItemKey)) {
  
              const moddedBaseItem = game.items.equipment.registeredObjects.get(baseItemKey);
              const moddedUpgradedItem = game.items.equipment.registeredObjects.get(upgradedItemKey);
  
              let newItemCosts = [];
              recipe.itemCosts.forEach(cost => {
                // If the cost is the base item, push the modded item using the mod namespace
                if (cost.item.name === recipe.rootItems[0].name) {
                  newItemCosts.push({
                    id: `${moddedBaseItem.namespace}:${moddedBaseItem.localID}`,
                    quantity: cost.quantity
                  });
                }
                // Otherwise, this is a vanilla item, so use the vanilla namespace
                else {
                  newItemCosts.push({
                    id: `${cost.item.namespace}:${cost.item.localID}`,
                    quantity: cost.quantity
                  });
                }
              });
  
              // Create new itemUpgrade and add it to itemUpgradeData
              let newItemUpgrade = {
                upgradedItemID: `${this.manifest.namespace}:${moddedUpgradedItem.localID}`,
                gpCost: recipe.gpCost,
                scCost: recipe.scCost,
                itemCosts: newItemCosts,
                rootItemIDs: [
                  `${moddedBaseItem.namespace}:${moddedBaseItem.localID}`
                ],
                isDowngrade: recipe.isDowngrade
              };
  
              // Check if itemUpgradeData already contains the newItemUpgrade
              let isDuplicate = itemUpgradeData.some(item => 
                item.upgradedItemID === newItemUpgrade.upgradedItemID
              );

              // Add it to itemUpgradeData only if it is not a duplicate
              if (!isDuplicate) {
                itemUpgradeData.push(newItemUpgrade);
              }

              index += 1;
              baseItemKey = `${this.manifest.namespace}:${recipe.rootItems[0].localID}_${rarity.name}_${index}`;
              upgradedItemKey = `${this.manifest.namespace}:${recipe.upgradedItem.localID}_${rarity.name}_${index}`;
            }
          }
        });
      });

      game.bank.registerItemUpgrades(itemUpgradeData);
    }
  }

  /**
   * Generates and adds weapon variants for the specified weapon to the item package.
   * @param {object} weapon - The weapon to generate variants for.
   * @param {object} itemPackage - The item package to add the variants to.
   */
  addWeaponVariantsForRarities(weapon, itemPackage) {
    // Pre-generate necessary data
    let newEquipRequirements = this.copyEquipRequirements(weapon.equipRequirements);
    let providedRunes = this.copyProvidedRunes(weapon.providedRunes);
    let modifiers = this.copyExistingModifiers(weapon.modifiers);
    let conditionalModifiers = this.copyConditionalModifiers(weapon.conditionalModifiers);

    // Generate and add item variants for each rarity
    this.generateItemVariantsForRarities(
      weapon,
      (item, rarity, index) => this.addWeaponVariant(item, rarity, index, newEquipRequirements, providedRunes, modifiers, conditionalModifiers, itemPackage)
    );
  }

  /**
   * Generates and adds equipment variants for the specified equipment to the item package.
   * @param {object} equipment - The equipment to generate variants for.
   * @param {object} itemPackage - The item package to add the variants to.
   */
  addEquipmentVariantsForRarities(equipment, itemPackage) {
    // Pre-generate necessary data
    let newEquipRequirements = this.copyEquipRequirements(equipment.equipRequirements);
    let providedRunes = this.copyProvidedRunes(equipment.providedRunes);
    let modifiers = this.copyExistingModifiers(equipment.modifiers);
    let conditionalModifiers = this.copyConditionalModifiers(equipment.conditionalModifiers);
    let fightEffects = this.copyFightEffects(equipment.fightEffects);

    // Generate and add item variants for each rarity
    this.generateItemVariantsForRarities(
      equipment,
      (item, rarity, index) => this.addEquipmentVariant(item, rarity, index, newEquipRequirements, modifiers, providedRunes, fightEffects, conditionalModifiers, itemPackage)
    );
  }

  /**
   * Generates a clean equipRequirements array that can be used in a new item
   * @param {Array} equipRequirements - The original equipment requirements.
   * @returns {Array} - The generated equipment requirements.
   */
  copyEquipRequirements(equipRequirements) {
    let newEquipRequirements = [];
    if (equipRequirements) {
      equipRequirements.forEach(req => {
        if (req && req.skill && req.skill.localID) {
          newEquipRequirements.push({
            type: req.type,
            skillID: `${req.skill.namespace}:${req.skill.localID}`,
            level: req.level
          });
        } else if (req && req.dungeon && req.dungeon.localID) {
          newEquipRequirements.push({
            type: req.type,
            dungeonID: `${req.dungeon.namespace}:${req.dungeon.localID}`,
            count: req.count
          });
        }
      });
    }
    return newEquipRequirements;
  }

  /**
 * Generates a clean providedRunes array that can be used in a new item
 * @param {Array} providedRunes - The original provided runes.
 * @returns {Array} - The generated provided runes.
 */
  copyProvidedRunes(providedRunes) {
    let runes = [];
    if (providedRunes) {
      providedRunes.forEach(rune => {
        if (rune && rune.item && rune.item._localID) {
          runes.push({
            id: `${rune.item._namespace.name}:${rune.item._localID}`,
            quantity: rune.quantity
          });
        }
      });
    }
    return runes;
  }

  /**
   * Generates a clean modifiers map that can be used in a new item
   * @param {object} modifiers - The original modifiers.
   * @returns {object} - The generated modifiers map.
   */
  copyExistingModifiers(modifiers) {
    if (!modifiers) {
      return {};
    }

    let generatedModifiers = {};
    for (let key in modifiers) {
      const modData = modifiers[key];
      if (Array.isArray(modData) && modData[0] && modData[0].skill.localID) {
        generatedModifiers[key] = modData.map(data => ({
          skillID: `${data.skill.namespace}:${data.skill.localID}`,
          value: data.value
        }));
      } else {
        generatedModifiers[key] = modData;
      }
    }
    return generatedModifiers;
  }

  /**
   * Generates a clean conditionalModifiers array that can be used in a new item
   * @param {object} conditionalModifiers - The original conditional modifiers.
   * @returns {Array} - The generated conditional modifiers.
   */
  copyConditionalModifiers(conditionalModifiers) {
    let generatedConditionalModifiers = [];
    if (conditionalModifiers) {
      for (let key in conditionalModifiers) {
        const condModData = conditionalModifiers[key];

        const processedCondMod = {
          condition: condModData.condition ? condModData.condition : null
        };

        // If there's an item condition, return for now.
        // TODO: Look into making this work
        if (processedCondMod.condition.item) {
          return;
        }

        if (condModData.modifiers) {
          const modifiers = {};
          for (let modKey in condModData.modifiers) {
            const modData = condModData.modifiers[modKey];
            modifiers[modKey] = modData;
          }
          processedCondMod.modifiers = modifiers;
        }

        if (condModData.enemyModifiers) {
          const enemyModifiers = {};
          for (let modKey in condModData.enemyModifiers) {
            const modData = condModData.enemyModifiers[modKey];
            enemyModifiers[modKey] = modData;
          }
          processedCondMod.enemyModifiers = enemyModifiers;
        }

        generatedConditionalModifiers.push(processedCondMod);
      }
    }
    return generatedConditionalModifiers;
  }

  /**
   * Generates a clean fightEffects array that can be used in a new item
   * @param {Array} fightEffects - The original fight effects.
   * @returns {Array} - The generated fight effects.
   */
  copyFightEffects(fightEffects) {
    let generatedFightEffects = [];
    if (fightEffects) {
      fightEffects.forEach(effect => {
        if (effect && effect.localID) {
          generatedFightEffects.push(`${effect.namespace}:${effect.localID}`);
        }
      });
    }
    return generatedFightEffects;
  }

  /**
   * Generates item variants for different rarities.
   * @param {object} item - The original item.
   * @param {Function} generateVariantFn - The function to generate item variants.
   */
  generateItemVariantsForRarities(item, addItemVariantFn) {
    this.config.rarities.forEach(rarity => {
      for (let i = 0; i < rarity.amountToGenerate; i++) {
        addItemVariantFn(item, rarity, i);
      }
    });
  }

  /**
   * Adds a weapon variant to the item package.
   * @param {object} weapon - The original weapon.
   * @param {object} rarity - The rarity of the variant.
   * @param {number} index - The index of the variant.
   * @param {Array} newEquipRequirements - The generated equip requirements.
   * @param {Array} providedRunes - The generated provided runes.
   * @param {object|null} modifiers - The generated modifiers, or null if there are no modifiers.
   * @param {Array} conditionalModifiers - The generated conditional modifiers.
   * @param {object} itemPackage - The item package to add the variant to.
   */
  addWeaponVariant(weapon, rarity, index, newEquipRequirements, providedRunes, modifiers, conditionalModifiers, itemPackage) {
    let variant = this.itemEditor.generateWeaponVariant(weapon, rarity, this.config.fluxPercentage);

    let specialAttacks = this.itemEditor.generateSpecialAttacks(weapon, rarity);
    let specialAttackIDs = [];
    let specialAttackChances = [];

    if (specialAttacks) {
      specialAttackIDs = specialAttacks.map(attack => attack.id);
      specialAttackChances = specialAttacks.map(attack => attack.defaultChance);

      if (specialAttackChances && weapon.overrideSpecialChances && weapon.overrideSpecialChances.length > 0) {
        for (let i = 0; i < specialAttackChances.length; i++) {
          if (weapon.overrideSpecialChances[i] != undefined) {
            specialAttackChances[i] = weapon.overrideSpecialChances[i];
          }
        }

        let sum = specialAttackChances.reduce((a, b) => a + b, 0);
        if (sum > 100) {
          specialAttackChances = specialAttackChances.map(chance => Math.round((chance / sum) * 100));
        }
      }
    }

    itemPackage.items.add({
      id: `${weapon.localID}_${rarity.name}_${index}`,
      itemType: 'Weapon',
      name: variant.name,
      customDescription: weapon._customDescription,
      category: weapon.category,
      type: weapon.type,
      ammoTypeRequired: AmmoTypeID[weapon.ammoTypeRequired],
      media: `https://cdn.melvor.net/core/v018/${weapon.media}?rarity=${rarity.name}`,
      ignoreCompletion: weapon.ignoreCompletion,
      obtainFromItemLog: weapon.obtainFromItemLog,
      golbinRaidExclusive: weapon.golbinRaidExclusive,
      sellsFor: weapon.sellsFor,
      tier: weapon.tier,
      validSlots: weapon.validSlots || ['Weapon'],
      occupiesSlots: weapon.occupiesSlots || [],
      equipRequirements: newEquipRequirements,
      equipmentStats: variant.equipmentStats,
      modifiers: modifiers ? modifiers : {},
      enemyModifiers: weapon.enemyModifiers,
      conditionalModifiers: conditionalModifiers,
      specialAttacks: specialAttackIDs,
      overrideSpecialChances: specialAttackChances,
      fightEffects: weapon.fightEffects,
      providedRunes: providedRunes,
      ammoType: weapon.ammoType,
      consumesChargesOn: weapon.consumesChargesOn,
      consumesOn: weapon.consumesOn,
      consumesItemOn: weapon.consumesItemOn,
      attackType: weapon.attackType
    });
  }

  /**
   * Adds an equipment variant to the item package.
   * @param {object} equipment - The original equipment.
   * @param {object} rarity - The rarity of the variant.
   * @param {number} index - The index of the variant.
   * @param {Array} newEquipRequirements - The copied equip requirements.
   * @param {object} modifiers - The copied modifiers.
   * @param {Array} providedRunes - The copied provided runes.
   * @param {Array} fightEffects - The copied fight effects.
   * @param {Array} conditionalModifiers - The copied conditional modifiers.
   * @param {object} itemPackage - The item package to add the variant to.
   */
  addEquipmentVariant(equipment, rarity, index, newEquipRequirements, modifiers, providedRunes, fightEffects, conditionalModifiers, itemPackage) {
    let variant = this.itemEditor.generateEquipmentVariant(equipment, rarity, this.config.fluxPercentage);

    //Merge the existing modifiers with the new generated ones
    let newModifiers = {
      ...modifiers,
      ...this.itemEditor.generateEquipmentModifiers(rarity)
    }

    itemPackage.items.add({
      id: `${equipment.localID}_${rarity.name}_${index}`,
      itemType: 'Equipment',
      name: variant.name,
      // customDescription: equipment._customDescription,
      category: equipment.category,
      type: equipment.itemType,
      media: `https://cdn.melvor.net/core/v018/${equipment.media}?rarity=${rarity.name}`,
      ignoreCompletion: equipment.ignoreCompletion,
      obtainFromItemLog: equipment.obtainFromItemLog,
      golbinRaidExclusive: equipment.golbinRaidExclusive,
      sellsFor: equipment.sellsFor,
      tier: equipment.tier,
      validSlots: equipment.validSlots || [],
      occupiesSlots: equipment.occupiesSlots || [],
      equipRequirements: newEquipRequirements,
      equipmentStats: variant.equipmentStats,
      modifiers: newModifiers ? newModifiers : {},
      enemyModifiers: equipment.enemyModifiers,
      conditionalModifiers: conditionalModifiers,
      fightEffects: fightEffects,
      providedRunes: providedRunes,
      consumesChargesOn: equipment.consumesChargesOn,
      consumesOn: equipment.consumesOn,
      consumesItemOn: equipment.consumesItemOn
    });
  }
}