export class Storage {
  /**
   * Constructs a Storage instance.
   * 
   * @param {string} manifest - The manifest containing the mod namespace.
   * @param {Object} characterStorage - The storage object to save to and load from.
   * @param {Object} stringCompressor - The compression helper class.
   */
  constructor(manifest, characterStorage, stringCompressor) {
    this.bank = game.bank;
    this.namespace = manifest.namespace;
    this.characterStorage = characterStorage;
    this.compression = stringCompressor;
    this.equipmentSlots = [
      "Helmet",
      "Platebody",
      "Platelegs",
      "Boots",
      "Weapon",
      "Shield",
      "Amulet",
      "Ring",
      "Gloves",
      "Quiver",
      "Cape",
      "Passive",
      "Summon1",
      "Summon2",
      "Consumable"
    ];
  }

  /**
 * Saves items in the associated namespace to character storage in a compact string format.
 */
  saveToCharacterStorage() {
    if (!Array.isArray(this.bank.itemsByTab)) {
      console.error('Bank itemsByTab is not an array');
      return;
    }

    // Initialize an empty array. This array will be used to store formatted strings representing each item to be saved
    let data = [];

    // Start by saving all modded items that are currently equipped
    let equipmentSets = game.combat.player.equipmentSets;
    for (let setIndex = 0; setIndex < equipmentSets.length; setIndex++) {
      const equipmentSet = equipmentSets[setIndex];

      // We need to check if the equipment set and slotArray exist and are arrays to avoid runtime errors
      if (equipmentSet && equipmentSet.equipment && Array.isArray(equipmentSet.equipment.slotArray)) {
        for (let slotIndex = 0; slotIndex < equipmentSet.equipment.slotArray.length; slotIndex++) {
          const slotItem = equipmentSet.equipment.slotArray[slotIndex].item;
          const slotQuantity = equipmentSet.equipment.slotArray[slotIndex].quantity;

          // We only save the slot item if it exists, is not empty, belongs to the correct namespace, and its quantity is greater than zero
          if (slotItem &&
            slotItem.localID !== 'Empty_Equipment' &&
            slotItem.namespace === this.namespace &&
            slotQuantity > 0) {

            // We compress the slot item id by replacing the full rarity word with its first character
            const compressedSlotItemId = slotItem.localID.replace(/_(uncommon|rare|legendary)_(\d)/, (_, rarity, number) => {
              return rarity.charAt(0) + number;
            });

            // We then push a string representing the item onto the data array
            data.push(`0${setIndex}${slotIndex},${compressedSlotItemId},${slotQuantity}`);
          }
        }
      }
    }

    // After saving all equipped items, we save all modded items in the bank
    for (let tabIndex = 0; tabIndex < this.bank.itemsByTab.length; tabIndex++) {
      let tab = this.bank.itemsByTab[tabIndex];

      for (let itemIndex = 0; itemIndex < tab.length; itemIndex++) {
        let bankItem = tab[itemIndex];

        // We only save the bank item if it exists and belongs to the correct namespace
        if (bankItem && bankItem.item && bankItem.item.namespace === this.namespace) {
          // We compress the bank item id just like the slot item id
          const compressedBankItemId = bankItem.item.localID.replace(/_(uncommon|rare|legendary)_(\d)/, (_, rarity, number) => {
            return rarity.charAt(0) + number;
          });

          // We then push a string representing the item onto the data array
          data.push(`1${tabIndex.toString().padStart(2, '0')}${itemIndex.toString().padStart(4, '0')},${compressedBankItemId},${bankItem.quantity}`);
        }
      }
    }

    // We join the data array into a single string using semicolons as separators
    let saveString = data.join(';');

    // We then compress the save string using Huffman compression
    let compressedData = this.compression.huffmanCompress(saveString);

    // The compressed data is further reduced in size using base64 encoding
    let encodedData = this.compression.base64Encode(compressedData.compressed);

    // The encoded data and mapping are then saved to character storage
    this.characterStorage.setItem('save', encodedData);
    this.characterStorage.setItem('mapping', compressedData.mapping);

    // We return the encoded save data to signify a successful save
    return this.characterStorage.getItem('save');
  }

  /**
   * Loads items from character storage and decodes them into a structured format.
   *
   * @returns {Array<Object>} An array of objects containing itemID, quantity, type, and tabIndex properties.
   */
  loadFromCharacterStorage() {
    // Get the encoded string from character storage
    const encodedString = this.characterStorage.getItem('save');

    // If no save found, clear the legacy save if it exists
    if (!encodedString) {
      console.log('Path of Melvor: No save found, clearing legacy save if it exists...');
      if (this.characterStorage.getItem(this.namespace)) {
        this.characterStorage.clear();
      };
    }

    // Get the compression mapping from character storage
    const mapping = this.characterStorage.getItem('mapping');

    // If either encodedString or mapping is not present, return empty array
    if (!encodedString || !mapping) {
      return [];
    }

    // Unencode the string to binary, this reverses the base64 encoding that was done during the saving process
    const compressedBinary = this.compression.base64Decode(encodedString);

    // Decompress the binary string, this reverses the Huffman compression that was done during the saving process
    const decodedString = this.compression.huffmanDecompress({ compressed: compressedBinary, mapping: mapping });

    // Decode the save string into an array of objects containing the item data
    return decodedString.split(';').map(entry => {
      // For each entry, split it into its components
      const [typeAndIndex, ...itemData] = entry.split(',');

      // Equipment or Bank location is the first character of string
      const itemLocation = typeAndIndex[0];
      // Rest of the characters are the item details
      const indexes = typeAndIndex.slice(1);

      let itemType;
      let setIndex;
      let slotIndex;
      let tabIndex;
      let itemIndex;

      // Reconstruct the localId, joining the parts with a comma
      let localId = itemData.slice(0, itemData.length - 1).join(',');

      // The last entry in itemData is the quantity
      const quantity = itemData[itemData.length - 1];

      // Check if the item is located in equipment (itemLocation = '0')
      if (itemLocation === '0') {
        // The first index is the setIndex and the second one is the slotIndex
        setIndex = Number(indexes[0]);
        slotIndex = Number(indexes[1]);

        // Set the itemType based on the slotIndex
        itemType = this.equipmentSlots[slotIndex];

        // Reconstruct the slot item id by replacing rarity abbreviations (u, r, l) with their full forms
        const reconstructedSlotItemId = localId.replace(/(u|r|l)(\d)/g, (_, rarity, number) => {
          const fullRarity = rarity === 'u' ? 'uncommon' : rarity === 'r' ? 'rare' : 'legendary';
          return `_${fullRarity}_${number}`;
        });

        localId = reconstructedSlotItemId;
      } else {
        // If the item is not in equipment, it's in the bank
        // The first two indexes are the tabIndex and the rest are the itemIndex
        tabIndex = Number(indexes.slice(0, 2));
        itemIndex = Number(indexes.slice(2));
        itemType = 'Bank';

        // Reconstruct the bank item id by replacing rarity abbreviations (u, r, l) with their full forms
        const reconstructedBankItemId = localId.replace(/(u|r|l)(\d)/g, (_, rarity, number) => {
          const fullRarity = rarity === 'u' ? 'uncommon' : rarity === 'r' ? 'rare' : 'legendary';
          return `_${fullRarity}_${number}`;
        });

        localId = reconstructedBankItemId;
      }

      // Return an object representing the item, including its location, id, type, set index, tab index, item index and quantity
      return {
        itemLocation,
        id: `${this.namespace}:${localId}`,
        itemType,
        setIndex,
        tabIndex,
        itemIndex,
        quantity: Number(quantity)
      };
    });
  }

  /**
   * Loads items from save string into the game
   *
   * @param {Array<Object>} itemArray - An array of objects containing itemID, quantity, type, and tabIndex properties.
   */
  addItemsToGame(itemArray) {
    if (Array.isArray(itemArray)) {
      itemArray.forEach((item) => {
        const itemId = item.id;
        const itemType = item.itemType;

        if (item.itemLocation === '0') {
          const itemQuantity = item.quantity;
          const setIndex = item.setIndex;

          // Use the equipItem method for items part of an equipment set
          let newItem = game.items.equipment.registeredObjects.get(itemId);
          if (newItem) {
            game.combat.player.equipmentSets[setIndex].equipment.equipItem(
              newItem,
              itemType,
              itemQuantity
            );
          }
        } else if (item.itemLocation === '1') {
          const itemQuantity = item.quantity;
          const tabIndex = item.tabIndex;

          // Use the addItemByID method for bank items
          let newItem = game.items.equipment.registeredObjects.get(itemId);
          if (newItem) {
            game.bank.defaultItemTabs.set(newItem, tabIndex);
            game.bank.addItem(newItem, itemQuantity, true, true, true, false, this.namespace);
            game.bank.defaultItemTabs.set(newItem, 0);
          }
        }
      });
    }
  }
}
