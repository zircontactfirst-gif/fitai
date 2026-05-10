export async function compressImage(file: File | Blob): Promise<{ data: string; mime: string }> {
  const maxSize = 1000; // max width/height
  const quality = 0.8;
  const mimeType = "image/webp"; // webp for better compression

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let { width, height } = img;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          return reject(new Error("Failed to get canvas context"));
        }

        // Fill background white in case of transparency
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL(mimeType, quality);
        const [meta, data] = dataUrl.split(",");
        const match = meta.match(/data:([^;]+);/);
        const actualMime = match ? match[1] : mimeType;
        resolve({ data, mime: actualMime });
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

// Basic deterministic checks
export async function checkImageQuality(file: File | Blob): Promise<{ valid: boolean; reason?: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        // Very basic dimension checks to reject obviously wrong crops
        if (img.width < 300 || img.height < 300) {
          return resolve({ valid: false, reason: "Image is too low resolution. Please take a clearer photo." });
        }
        resolve({ valid: true });
      };
      img.onerror = () => reject(new Error("Invalid image format"));
    };
    reader.onerror = () => reject(new Error("Failed to read image"));
  });
}
