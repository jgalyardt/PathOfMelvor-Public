export class StringCompressor {
  constructor() {}

  base64Encode(binaryString) {
    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let encodedString = '';
    let padding = 0;
  
    for (let i = 0; i < binaryString.length; i += 6) {
      const group = binaryString.slice(i, i + 6).padEnd(6, '0');
      const decimal = parseInt(group, 2);
      encodedString += base64Chars[decimal];
    }
  
    // Calculate padding based on the remaining bits
    if (binaryString.length % 6 === 2) {
      padding = 2;
    } else if (binaryString.length % 6 === 4) {
      padding = 1;
    }
  
    // Add padding characters if necessary
    encodedString += '='.repeat(padding);
  
    return encodedString;
  }
  
  base64Decode(encodedString) {
    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let binaryString = '';
  
    // Remove padding characters from the encoded string
    const unpaddedEncoded = encodedString.replace(/=/g, '');
  
    for (let i = 0; i < unpaddedEncoded.length; i++) {
      const char = unpaddedEncoded[i];
      const decimal = base64Chars.indexOf(char);
      const group = decimal.toString(2).padStart(6, '0');
      binaryString += group;
    }
  
    // Calculate the number of bits to remove based on the padding
    const paddingLength = encodedString.length - unpaddedEncoded.length;
    const bitsToRemove = paddingLength > 0 ? paddingLength * 2 : 0;
  
    // Remove any remaining bits if padding was used
    if (bitsToRemove > 0) {
      binaryString = binaryString.slice(0, -bitsToRemove);
    }
  
    return binaryString;
  }

  buildFrequencyTable(str) {
    let frequency = {};
    for (let char of str) {
      frequency[char] = (frequency[char] || 0) + 1;
    }
    return frequency;
  }

  buildHuffmanTree(frequency) {
    let heap = Object.keys(frequency).map(char => ({ char, freq: frequency[char] }));
    heap.sort((a, b) => a.freq - b.freq);

    while (heap.length > 1) {
      let [node1, node2] = heap.splice(0, 2);
      let mergedNode = { freq: node1.freq + node2.freq, left: node1, right: node2 };
      let insertIdx = heap.findIndex(n => n.freq > mergedNode.freq);
      if (insertIdx !== -1) {
        heap.splice(insertIdx, 0, mergedNode);
      } else {
        heap.push(mergedNode);
      }
    }

    return heap[0];
  }

  buildHuffmanCodes(node, code = '', mapping = {}) {
    if (!node) return;

    if (node.char !== undefined) {
      mapping[node.char] = code;
    }
    if (node.left) {
      this.buildHuffmanCodes(node.left, code + '0', mapping);
    }
    if (node.right) {
      this.buildHuffmanCodes(node.right, code + '1', mapping);
    }
    return mapping;
  }

  huffmanCompress(str) {
    let frequency = this.buildFrequencyTable(str);
    let tree = this.buildHuffmanTree(frequency);
    let mapping = this.buildHuffmanCodes(tree);

    let compressedBinary = '';
    for (let char of str) {
      compressedBinary += mapping[char];
    }

    return { compressed: compressedBinary, mapping };
  }

  huffmanDecompress({ compressed, mapping }) {
    let reverseMapping = {};
    for (let char in mapping) {
      reverseMapping[mapping[char]] = char;
    }

    let decompressed = '';
    let code = '';
    for (let bit of compressed) {
      code += bit;
      if (reverseMapping[code]) {
        decompressed += reverseMapping[code];
        code = '';
      }
    }

    return decompressed;
  }
}
