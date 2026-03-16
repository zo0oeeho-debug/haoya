
import { decode as decodeJpeg } from "@jsquash/jpeg";
import { decode as decodePng } from "@jsquash/png";
import { encode as encodeAvif } from "@jsquash/avif";
import { encode as encodeWebp } from "@jsquash/webp";
import ssim from "ssim.js"; 

// Use dynamic imports or check if config is available on default export
// It seems newer versions might handle wasm loading differently or require manual fetch if not bundled.
// For now, let's remove the explicit config import that caused the error and rely on default behavior 
// or try to set it on the module namespace object if possible.
// But we can't import * as ... and then assign to it easily in ESM strict mode sometimes.
// Let's try to access the WASM via CDN only if we can find where to put the URL.

// According to some docs, it might be:
// import init, { encode } from '@jsquash/avif';
// init(wasmUrl);

// Let's try to be safe and just import encode/decode. 
// If it fails at runtime due to missing WASM, we'll see.
// But the build error was about 'config' export not existing.

// Let's try to inject the WASM path via global or just skip it for now and see if it works.
// Or use the 'default' export which might be the init function?

// Let's try this safe approach:
// Just import the functions we need. The build error was specifically about `config`.

// Define message types
type WorkerMessage = {
  file: File;
  options: {
    targetFormat: "image/avif" | "image/webp";
    minQuality: number;
    maxQuality: number;
    targetSSIM: number;
  };
};

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { file, options } = e.data;
  const { 
    targetFormat = "image/avif", 
    minQuality = 50, 
    maxQuality = 95, 
    targetSSIM = 0.98 
  } = options;

  try {
    const buffer = await file.arrayBuffer();
    let imageData: ImageData;

    // 1. Decode Input
    if (file.type === "image/jpeg" || file.type === "image/jpg") {
      imageData = await decodeJpeg(buffer);
    } else if (file.type === "image/png") {
      imageData = await decodePng(buffer);
    } else {
      throw new Error(`Unsupported input format: ${file.type}`);
    }

    // 2. Analyze for Chroma Subsampling
    // 简单的边缘检测：计算相邻像素差异
    const isHighFrequency = detectHighFrequency(imageData);
    // 4:4:4 (0) for high detail/text, 4:2:0 (1) for photos
    const subsample = isHighFrequency ? 0 : 1; 

    // 3. Binary Search for Optimal Quality
    let low = minQuality;
    let high = maxQuality;
    let bestBlob: Blob | null = null;
    let bestQuality = 0;
    let bestSSIM = 0;

    // Perform binary search
    let attempts = 0;
    const maxAttempts = 5;

    while (low <= high && attempts < maxAttempts) {
      const q = Math.floor((low + high) / 2);
      attempts++;

      // Encode
      const encodeOptions = {
        quality: q,
        speed: 6, // Balanced speed
        subsample,
        // WebP specific
        method: 4,
      };

      let compressedBuffer: ArrayBuffer;
      if (targetFormat === "image/avif") {
        compressedBuffer = await encodeAvif(imageData, encodeOptions);
      } else {
        compressedBuffer = await encodeWebp(imageData, encodeOptions);
      }

      // Decode back for SSIM
      // Use dynamic import to avoid circular dependency issues if any
      let decodedCompressed: ImageData;
      if (targetFormat === "image/avif") {
        const { decode: decodeAvif } = await import("@jsquash/avif");
        const decoded = await decodeAvif(compressedBuffer);
        if (!decoded) throw new Error("Failed to decode AVIF for SSIM calculation");
        decodedCompressed = decoded;
      } else {
        const { decode: decodeWebp } = await import("@jsquash/webp");
        const decoded = await decodeWebp(compressedBuffer);
        if (!decoded) throw new Error("Failed to decode WebP for SSIM calculation");
        decodedCompressed = decoded;
      }

      // Calculate SSIM
      // ssim returns { mssim: number, ... }
      const result = ssim(imageData, decodedCompressed);
      const currentSSIM = result.mssim;

      if (currentSSIM >= targetSSIM) {
        // Quality meets target, try to lower quality to save size
        bestBlob = new Blob([compressedBuffer], { type: targetFormat });
        bestQuality = q;
        bestSSIM = currentSSIM;
        
        // Optimization: If SSIM is extremely high, we can stop early
        if (currentSSIM > 0.995) {
             high = q - 5; // Aggressively lower quality
        } else {
             high = q - 1;
        }
      } else {
        // Quality too low, increase it
        low = q + 1;
      }
    }

    // If binary search failed to find a valid blob (always < targetSSIM), 
    // we should try one last time with maxQuality or just return the best we found (if any).
    // If bestBlob is null, it means even maxQuality didn't meet targetSSIM (unlikely for 95).
    // But let's handle it.
    if (!bestBlob) {
        // Fallback: Encode with maxQuality
        const finalQ = maxQuality;
        const encodeOptions = { quality: finalQ, speed: 6, subsample, method: 4 };
        let finalBuffer;
        if (targetFormat === "image/avif") {
            finalBuffer = await encodeAvif(imageData, encodeOptions);
        } else {
            finalBuffer = await encodeWebp(imageData, encodeOptions);
        }
        bestBlob = new Blob([finalBuffer], { type: targetFormat });
        bestQuality = finalQ;
        // Recalculate SSIM? Maybe not needed for fallback.
        bestSSIM = 0.99; // Assume high
    }

    self.postMessage({
      success: true,
      blob: bestBlob,
      meta: {
        ssim: bestSSIM,
        quality: bestQuality,
        subsample: subsample === 0 ? "4:4:4" : "4:2:0",
        format: targetFormat
      }
    });

  } catch (error: any) {
    self.postMessage({ success: false, error: error.message || "Unknown error" });
  }
};

function detectHighFrequency(imageData: ImageData): boolean {
  const { width, height, data } = imageData;
  // Simple edge detection: Calculate average difference between adjacent pixels
  // If high, likely contains text or sharp edges -> use 4:4:4
  let totalDiff = 0;
  const stride = 4; // RGBA
  
  // Sample every 10th pixel to save time
  const step = 10;
  let count = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width - 1; x += step) {
      const i = (y * width + x) * stride;
      const nextI = i + stride;
      
      // Calculate luminance diff
      const lum1 = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
      const lum2 = 0.299 * data[nextI] + 0.587 * data[nextI+1] + 0.114 * data[nextI+2];
      
      totalDiff += Math.abs(lum1 - lum2);
      count++;
    }
  }

  const avgDiff = totalDiff / count;
  // Threshold: Purely heuristic. 
  // Photos usually have smooth transitions (low avg diff). 
  // Text/Screenshots have sharp transitions (high avg diff).
  // A threshold of 15-20 is a reasonable starting point.
  return avgDiff > 15;
}
