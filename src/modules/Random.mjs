// This class uses the Mulberry32 algorithm for generating random numbers
export class Random {
  constructor(str) {
    this.a = 0;
    for (let i = 0, len = str.length; i < len; i++) {
      let chr = str.charCodeAt(i);
      this.a = (this.a << 5) - this.a + chr;
      this.a |= 0; // Convert to 32bit integer
    }
  }

  random() {
    var t = this.a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  float(min = 0.0, max = 1.0) {
    return this.random() * (max - min) + min;
  }

  int(min = 0, max = 100) {
    return Math.floor(this.random() * (max - min) + min);
  }
}
