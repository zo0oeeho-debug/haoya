
// Polyfill for Map.prototype.getOrInsertComputed (required by pdfjs-dist v5+)
// @ts-ignore
if (typeof Map !== "undefined" && !Map.prototype.getOrInsertComputed) {
  // @ts-ignore
  Map.prototype.getOrInsertComputed = function(key, compute) {
    if (this.has(key)) return this.get(key);
    const value = compute(key);
    this.set(key, value);
    return value;
  };
  console.log("Map.prototype.getOrInsertComputed polyfill applied");
}

// Polyfill for Promise.withResolvers (also used by newer pdfjs-dist)
// @ts-ignore
if (typeof Promise.withResolvers === "undefined") {
  // @ts-ignore
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
  console.log("Promise.withResolvers polyfill applied");
}
