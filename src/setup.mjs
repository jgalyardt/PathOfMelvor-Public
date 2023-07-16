export async function setup({ characterStorage, patch, loadModule, loadData, onCharacterLoaded, onInterfaceReady }) {

  const { Debug } = await loadModule('modules/Debug.mjs');
  const { ItemPackageBuilder } = await loadModule('modules/ItemPackageBuilder.mjs');
  const { ItemEditor } = await loadModule('modules/ItemEditor.mjs');
  const { MonsterEditor } = await loadModule('modules/MonsterEditor.mjs');
  const { Patches } = await loadModule('modules/Patches.mjs');
  const { Random } = await loadModule('modules/Random.mjs');
  const { RandomUtils } = await loadModule('modules/RandomUtils.mjs');
  const { Storage } = await loadModule('modules/Storage.mjs');
  const { StringCompressor } = await loadModule('modules/StringCompressor.mjs');

  const manifest = await loadData('manifest.json');
  const config = await loadData('config.json');
  const monsterEditor = new MonsterEditor(manifest, config);
  const randomUtils = new RandomUtils(manifest, config);
  const storage = new Storage(manifest, characterStorage, new StringCompressor());
  const patches = new Patches(patch, randomUtils, storage);

  if (config && config.isDebugEnabled) {
    //Debug assigns a global window object
    new Debug(config, storage);
  }

  patches.applyPatches();

  onCharacterLoaded(ctx => {
    //Initialize the random generator using the character name as the seed
    const rand = new Random(game.characterName);
    const itemEditor = new ItemEditor(manifest, config, rand);
    const itemPackageBuilder = new ItemPackageBuilder(manifest, config, itemEditor);
    const bannedList = config && config.bannedList ? config.bannedList : {};

    const initialPackage = ctx.gameData.buildPackage(itemPackage => {
      //Generate Equipment
      game.items.equipment.registeredObjects.forEach(equipment => {
        if (equipment && equipment.validSlots && equipment.validSlots[0] &&
          (equipment.validSlots[0] === 'Boots' ||
            equipment.validSlots[0] === 'Gloves' ||
            equipment.validSlots[0] === 'Helmet' ||
            equipment.validSlots[0] === 'Platebody' ||
            equipment.validSlots[0] === 'Platelegs' ||
            equipment.validSlots[0] === 'Shield'
          )) {
          // Skip the item if its localID is in the bannedList
          if (bannedList[equipment.localID]) {
            return;
          }
          itemPackageBuilder.addEquipmentVariantsForRarities(equipment, itemPackage);
        }
      });

      //Generate Weapons
      game.items.weapons.registeredObjects.forEach(weapon => {
        if (weapon && weapon.validSlots && weapon.validSlots[0] &&
          (weapon.validSlots[0] === 'Weapon')) {
          // Skip the item if its localID is in the bannedList
          if (bannedList[weapon.localID]) {
            return;
          }
          itemPackageBuilder.addWeaponVariantsForRarities(weapon, itemPackage);
        }
      });
    });
    initialPackage.add();

    //Load all the modded items for this character
    const itemsToLoad = storage.loadFromCharacterStorage();
    storage.addItemsToGame(itemsToLoad);
    game.combat.player.computeAllStats();

    //Add recipes to bank
    itemPackageBuilder.addUpgradeRecipes();

    //Add modded items to monster drop tables
    monsterEditor.addModdedItemsToDropTables();
  });

  onInterfaceReady(ctx => {
    //Make a render call to ensure any loaded items display in the UI
    game.combat.player.rendersRequired.equipment = true;
    game.combat.player.render();
  });
}