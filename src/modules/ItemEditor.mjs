/**
 * The ItemEditor class provides methods for generating variants of equipment and weapons
 * with randomized stats and modifiers.
 */
export class ItemEditor {
  /**
   * Creates an instance of ItemEditor.
   * @param {object} manifest - The game manifest.
   * @param {object} config - The configuration object for equipment and weapon generation.
   * @param {object} rand - The random number generator.
   */
  constructor(manifest, config, rand) {
    this.manifest = manifest;
    this.config = config;
    this.rand = rand;
    this.equpmentTypes = ['melee', 'ranged', 'magic'];

    // Store the modifiers specified in the equipment JSON to reference later
    this.modifiers = (function () {
      let dict = {};
      let equipmentTypes = ['melee', 'ranged', 'magic'];
      equipmentTypes.forEach(type => {
        dict[type] = [];
        let modPool = config.modifiers[type];
        for (const modifierName in modPool) {
          const modifierValue = modPool[modifierName];
          dict[type].push({
            key: modifierName,
            value: modifierValue,
          });
        }
      });
      return dict;
    })();

    // Store the specialAttacks specified in the weapons JSON to reference later
    this.specialAttacks = (function () {
      let dict = {};
      config.rarities.forEach(rarity => {
        dict[rarity.name] = [];
        let index = 0;
        let key = `${manifest.namespace}:weapon_${rarity.name}_${index}`;
        while (game.specialAttacks.registeredObjects.has(key)) {
          let attackObj = game.specialAttacks.registeredObjects.get(key);
          dict[rarity.name].push({
            localID: attackObj.localID,
            defaultChance: attackObj.defaultChance,
          });
          index += 1;
          key = `${manifest.namespace}:weapon_${rarity.name}_${index}`;
        }
      });
      return dict;
    })();
  }

  /**
   * Randomizes the stats of equipment.
   * @param {object[]} equipmentStats - The array of equipment stats to be randomized.
   * @param {number} minBuffPercentage - The minimum percentage increase for stat buffs.
   * @param {number} maxBuffPercentage - The maximum percentage increase for stat buffs.
   * @param {number} maxNumberOfStatsToBuff - The maximum number of stats to buff.
   * @param {number} fluxPercentage - The percentage chance for additional random increase (flux).
   * @returns {object[]} - The randomized equipment stats.
   */
  randomizeEquipmentStats(equipmentStats, minBuffPercentage, maxBuffPercentage, maxNumberOfStatsToBuff, fluxPercentage) {
    // Calculate the number of stats to buff (cannot be more than the total number of stats)
    const numberOfStatsToBuff = Math.min(maxNumberOfStatsToBuff, equipmentStats.length);
    let statsToBuff = new Set();
    if (numberOfStatsToBuff === equipmentStats.length) {
      for (let i = 0; i < numberOfStatsToBuff; i++) {
        statsToBuff.add(i);
      }
    } else {
      while (statsToBuff.size < numberOfStatsToBuff) {
        // Select a random index from the equipmentStats array
        const randomIndex = Math.floor(this.rand.float() * equipmentStats.length);
        // Add the index to statsToBuff (it won't be added if it's already present)
        statsToBuff.add(randomIndex);
      }
    }

    // Create a deep copy of equipmentStats so the original is not modified
    let newEquipmentStats = JSON.parse(JSON.stringify(equipmentStats));

    for (const index of statsToBuff) {
      // Skip damage reduction, it's too strong to modify
      if (newEquipmentStats[index].key === 'damageReduction') {
        continue;
      }

      const baseValue = newEquipmentStats[index].value;

      // Calculate the flux (additional random increase), 50% chance of being non-zero
      const flux = this.rand.float() <= 0.5 ? this.rand.float() * fluxPercentage : 0;
      const randomBuffPercentage = minBuffPercentage + this.rand.float() * (maxBuffPercentage - minBuffPercentage);
      const totalPercentage = randomBuffPercentage + flux;

      // Calculate the new value of the stat, based on the total percentage increase
      let newValue;
      if (newEquipmentStats[index].key === 'attackSpeed') {
        // Invert the buff for attackSpeed (lower is better)
        newValue = baseValue * (1 - (this.rand.float() * totalPercentage / 100));
        newValue = Math.round(newValue / 10) * 10;
      } else {
        newValue = baseValue * (1 + (this.rand.float() * totalPercentage / 100));
      }
      newEquipmentStats[index].value = Math.round(newValue);

      // If this stat was affected by flux (50% chance), nerf a different stat
      // The goal of flux is to create more interesting items
      if (flux > 0 && statsToBuff.size < newEquipmentStats.length) {
        let nonBuffIndex;
        do {
          nonBuffIndex = Math.floor(this.rand.float() * newEquipmentStats.length);
        } while (nonBuffIndex === index);

        if (newEquipmentStats[nonBuffIndex].key === 'damageReduction') {
          continue;
        }

        if (newEquipmentStats[nonBuffIndex].key === 'attackSpeed') {
          // Invert the nerf for attackSpeed (higher is worse)
          const valueToIncrease = newEquipmentStats[nonBuffIndex].value;
          const adjustedValue = valueToIncrease + (baseValue * (flux / 100));
          newEquipmentStats[nonBuffIndex].value = Math.round(adjustedValue / 10) * 10;
        } else {
          const valueToDecrease = newEquipmentStats[nonBuffIndex].value;
          const adjustedValue = valueToDecrease - (baseValue * (flux / 100));
          // Decrease the stat, ensuring it doesn't go below 0
          newEquipmentStats[nonBuffIndex].value = Math.round(Math.max(adjustedValue, 0));
        }
      }
    }

    return newEquipmentStats;
  }

  /**
   * Generates a variant of equipment with randomized stats.
   * @param {object} equipment - The original equipment object.
   * @param {object} rarity - The rarity configuration for the variant.
   * @param {number} fluxPercentage - The percentage chance for additional random increase (flux).
   * @returns {object} - The generated equipment variant.
   */
  generateEquipmentVariant(equipment, rarity, fluxPercentage) {
    let randomizedStats = this.randomizeEquipmentStats(
      equipment.equipmentStats,
      rarity.minBuffPercentage,
      rarity.maxBuffPercentage,
      rarity.maxNumberOfStatsToBuff,
      fluxPercentage
    );

    let variant = {};
    variant.name = `${rarity.name.charAt(0).toUpperCase() + rarity.name.slice(1)} ${equipment.name}`;
    variant.equipmentStats = randomizedStats;
    variant.category = equipment.category;
    variant.type = equipment.type;
    variant.media = equipment.media;
    variant.ignoreCompletion = equipment.ignoreCompletion;
    variant.obtainFromItemLog = equipment.obtainFromItemLog;
    variant.golbinRaidExclusive = equipment.golbinRaidExclusive;
    variant.sellsFor = equipment.sellsFor;
    variant.tier = equipment.tier;
    variant.validSlots = equipment.validSlots.slice();
    variant.occupiesSlots = equipment.occupiesSlots.slice();
    variant.equipRequirements = equipment.equipRequirements.slice();
    variant.itemType = equipment.itemType;
    variant.attackType = equipment.attackType;

    return variant;
  }

  /**
   * Generates a variant of a weapon with randomized stats.
   * @param {object} weapon - The original weapon object.
   * @param {object} rarity - The rarity configuration for the variant.
   * @param {number} fluxPercentage - The percentage chance for additional random increase (flux).
   * @returns {object} - The generated weapon variant.
   */
  generateWeaponVariant(weapon, rarity, fluxPercentage) {
    let randomizedStats = this.randomizeEquipmentStats(
      weapon.equipmentStats,
      rarity.minBuffPercentage,
      rarity.maxBuffPercentage,
      rarity.maxNumberOfStatsToBuff,
      fluxPercentage
    );

    let variant = {};
    variant.name = `${rarity.name.charAt(0).toUpperCase() + rarity.name.slice(1)} ${weapon.name}`;
    variant.equipmentStats = randomizedStats;
    variant.category = weapon.category;
    variant.type = weapon.type;
    variant.media = weapon.media;
    variant.ignoreCompletion = weapon.ignoreCompletion;
    variant.obtainFromItemLog = weapon.obtainFromItemLog;
    variant.golbinRaidExclusive = weapon.golbinRaidExclusive;
    variant.sellsFor = weapon.sellsFor;
    variant.tier = weapon.tier;
    variant.validSlots = weapon.validSlots.slice();
    variant.occupiesSlots = weapon.occupiesSlots.slice();
    variant.equipRequirements = weapon.equipRequirements.slice();
    variant.itemType = weapon.itemType;
    variant.attackType = weapon.attackType;

    return variant;
  }

  /**
   * Generates equipment modifiers based on the specified rarity.
   * @param {object} rarity - The rarity configuration.
   * @param {string} equipmentType - The type (magic, melee, ranged) of the equipment
   * @returns {object} - The generated equipment modifiers.
   */
  generateEquipmentModifiers(rarity, equipmentType='any') {
    let equipmentModifiers = {};

    // Randomly select modifiers from the available modifiers for the given rarity
    for (let i = 0; i < rarity.modifierSlots; i++) {
      let availableModifiers = [];
      if (equipmentType === 'any') {
        let chosenType = this.equpmentTypes[this.rand.int(0, 3)]
        availableModifiers = this.modifiers[chosenType];
      }
      else {
        availableModifiers = this.modifiers[equipmentType];
      }

      let randomIndex = this.rand.int(0, availableModifiers.length);
      let selectedModifier = availableModifiers[randomIndex];

      //Reroll until a new mod is selected
      while (equipmentModifiers.hasOwnProperty(selectedModifier.key)) {
        randomIndex = this.rand.int(0, availableModifiers.length);
        selectedModifier = availableModifiers[randomIndex];
      }

      equipmentModifiers[selectedModifier.key] = selectedModifier.value;
    }

    // If the rarity is legendary, double the value of a random modifier
    if (rarity.name === 'legendary') {
      let modifierKeys = Object.keys(equipmentModifiers);
      let randomKey = modifierKeys[this.rand.int(0, modifierKeys.length)];
      while (randomKey === 'increasedMeleeStunThreshold') {
        randomKey = modifierKeys[this.rand.int(0, modifierKeys.length)];
      }
      equipmentModifiers[randomKey] *= 2;
    }

    return equipmentModifiers;
  }

  /**
   * Generates special attacks for a weapon based on the specified rarity.
   * @param {object} weapon - The original weapon object.
   * @param {object} rarity - The rarity configuration.
   * @returns {object[]} - The generated special attacks.
   */
  generateSpecialAttacks(weapon, rarity) {
    let specialAttacks = [];

    // Add existing specialAttacks
    if (weapon.specialAttacks) {
      weapon.specialAttacks.forEach(attack => {
        if (attack && attack.localID) {
          specialAttacks.push({
            id: `${attack.namespace}:${attack.localID}`,
            defaultChance: attack.defaultChance,
          });
        }
      });
    }

    // Iterate through the specialAttacks in rarity config and add an attack from each tier specified
    rarity.specialAttackSlots.forEach(attackRarity => {
      let attackArray = this.specialAttacks[attackRarity];
      let chosenAttackIndex = this.rand.int(0, attackArray.length);
      let chosenAttack = attackArray[chosenAttackIndex];
      let specialAttack = game.specialAttacks.registeredObjects.get(`${this.manifest.namespace}:${chosenAttack.localID}`);

      specialAttacks.push({
        id: `${this.manifest.namespace}:${chosenAttack.localID}`,
        defaultChance: specialAttack.defaultChance,
      });
    });

    return specialAttacks;
  }
}