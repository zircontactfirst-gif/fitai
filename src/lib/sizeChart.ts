// Bangladesh market size chart — based on common BD garment sizes (Aarong, Yellow,
// Cats Eye, Daraz averages). Measurements are body measurements (not garment).
// Use in/cm. cm values are rounded.

export type Size = "XS" | "S" | "M" | "L" | "XL" | "XXL" | "3XL";

export type SizeRange = {
  size: Size;
  chest_in: [number, number];
  shoulder_in: [number, number];
  waist_in: [number, number];
  length_in: [number, number]; // shirt length
  sleeve_in: [number, number];
};

export type GenderKey = "male" | "female" | "other";

// Men's upper body (Shirt / T-Shirt / Polo / Panjabi)
export const BD_MEN_TOP: SizeRange[] = [
  { size: "XS",  chest_in: [32, 34], shoulder_in: [15.5, 16.5], waist_in: [26, 28], length_in: [26, 27], sleeve_in: [22.5, 23] },
  { size: "S",   chest_in: [34, 36], shoulder_in: [16.5, 17.5], waist_in: [28, 30], length_in: [27, 28], sleeve_in: [23, 23.5] },
  { size: "M",   chest_in: [36, 38], shoulder_in: [17.5, 18.5], waist_in: [30, 32], length_in: [28, 29], sleeve_in: [23.5, 24] },
  { size: "L",   chest_in: [38, 41], shoulder_in: [18.5, 19.5], waist_in: [32, 34], length_in: [29, 30], sleeve_in: [24, 24.5] },
  { size: "XL",  chest_in: [41, 44], shoulder_in: [19.5, 20.5], waist_in: [34, 37], length_in: [30, 31], sleeve_in: [24.5, 25] },
  { size: "XXL", chest_in: [44, 47], shoulder_in: [20.5, 21.5], waist_in: [37, 40], length_in: [31, 32], sleeve_in: [25, 25.5] },
  { size: "3XL", chest_in: [47, 50], shoulder_in: [21.5, 22.5], waist_in: [40, 44], length_in: [32, 33], sleeve_in: [25.5, 26] },
];

// Women's upper body (Kurti / Top / Blouse)
export const BD_WOMEN_TOP: SizeRange[] = [
  { size: "XS",  chest_in: [30, 32], shoulder_in: [13.5, 14], waist_in: [24, 26], length_in: [36, 38], sleeve_in: [18, 18.5] },
  { size: "S",   chest_in: [32, 34], shoulder_in: [14, 14.5], waist_in: [26, 28], length_in: [38, 40], sleeve_in: [18.5, 19] },
  { size: "M",   chest_in: [34, 36], shoulder_in: [14.5, 15], waist_in: [28, 30], length_in: [40, 42], sleeve_in: [19, 19.5] },
  { size: "L",   chest_in: [36, 38], shoulder_in: [15, 15.5], waist_in: [30, 32], length_in: [42, 44], sleeve_in: [19.5, 20] },
  { size: "XL",  chest_in: [38, 41], shoulder_in: [15.5, 16], waist_in: [32, 35], length_in: [44, 45], sleeve_in: [20, 20.5] },
  { size: "XXL", chest_in: [41, 44], shoulder_in: [16, 16.5], waist_in: [35, 38], length_in: [45, 46], sleeve_in: [20.5, 21] },
  { size: "3XL", chest_in: [44, 47], shoulder_in: [16.5, 17], waist_in: [38, 42], length_in: [46, 47], sleeve_in: [21, 21.5] },
];

// Bottoms (Pant / Jeans) — sized by waist
export const BD_BOTTOMS: { size: Size; waist_in: [number, number]; hip_in: [number, number]; inseam_in: [number, number] }[] = [
  { size: "XS",  waist_in: [26, 28], hip_in: [33, 35], inseam_in: [29, 30] },
  { size: "S",   waist_in: [28, 30], hip_in: [35, 37], inseam_in: [30, 31] },
  { size: "M",   waist_in: [30, 32], hip_in: [37, 39], inseam_in: [30, 32] },
  { size: "L",   waist_in: [32, 34], hip_in: [39, 41], inseam_in: [31, 32] },
  { size: "XL",  waist_in: [34, 36], hip_in: [41, 43], inseam_in: [31, 33] },
  { size: "XXL", waist_in: [36, 39], hip_in: [43, 46], inseam_in: [32, 33] },
  { size: "3XL", waist_in: [39, 42], hip_in: [46, 49], inseam_in: [32, 34] },
];

export const inToCm = (v: number) => +(v * 2.54).toFixed(1);
export const cmToIn = (v: number) => +(v / 2.54).toFixed(1);

export function getChart(productType: string, gender: GenderKey): SizeRange[] {
  const lowerBody = ["Pant", "Jeans", "Trouser", "Chino"];
  if (lowerBody.includes(productType)) {
    return BD_BOTTOMS.map((b) => ({
      size: b.size,
      chest_in: [0, 0],
      shoulder_in: [0, 0],
      waist_in: b.waist_in,
      length_in: b.inseam_in,
      sleeve_in: [0, 0],
    }));
  }
  return gender === "female" ? BD_WOMEN_TOP : BD_MEN_TOP;
}

// Suggest a size from partial body measurements + height/weight as fallback.
// Returns size + which signal was used + a note.
export type SuggestionInput = {
  productType: string;
  gender: GenderKey;
  chest_in?: number;
  shoulder_in?: number;
  waist_in?: number;
  height_in?: number;
  weight_kg?: number;
};

export function suggestSize(input: SuggestionInput): {
  size: Size | null;
  source: string;
  note: string;
} {
  const chart = getChart(input.productType, input.gender);
  const inRange = (v: number, r: [number, number]) => v >= r[0] && v <= r[1];

  // Priority: chest > waist > shoulder > height/weight heuristic
  if (input.chest_in) {
    const m = chart.find((c) => inRange(input.chest_in!, c.chest_in));
    if (m) return { size: m.size, source: "chest", note: `Matched on chest ${input.chest_in}″` };
  }
  if (input.waist_in) {
    const m = chart.find((c) => inRange(input.waist_in!, c.waist_in));
    if (m) return { size: m.size, source: "waist", note: `Matched on waist ${input.waist_in}″` };
  }
  if (input.shoulder_in) {
    const m = chart.find((c) => inRange(input.shoulder_in!, c.shoulder_in));
    if (m) return { size: m.size, source: "shoulder", note: `Matched on shoulder ${input.shoulder_in}″` };
  }

  // Heuristic from height + weight (BMI-ish for BD adults)
  if (input.height_in && input.weight_kg) {
    const h_m = (input.height_in * 2.54) / 100;
    const bmi = input.weight_kg / (h_m * h_m);
    let size: Size = "M";
    if (bmi < 17) size = "XS";
    else if (bmi < 19) size = "S";
    else if (bmi < 23) size = "M";
    else if (bmi < 27) size = "L";
    else if (bmi < 31) size = "XL";
    else if (bmi < 35) size = "XXL";
    else size = "3XL";
    return { size, source: "bmi", note: `Estimated from height & weight (BMI ≈ ${bmi.toFixed(1)})` };
  }
  if (input.height_in) {
    let size: Size = "M";
    if (input.height_in < 62) size = "S";
    else if (input.height_in < 66) size = "M";
    else if (input.height_in < 70) size = "L";
    else size = "XL";
    return { size, source: "height", note: `Rough estimate from height only` };
  }
  return { size: null, source: "none", note: "Not enough data — please add chest, waist, or height & weight." };
}

export function formatSizeChartForPrompt(productType: string, gender: GenderKey): string {
  const chart = getChart(productType, gender);
  const isBottom = ["Pant", "Jeans", "Trouser", "Chino"].includes(productType);
  const header = isBottom
    ? "Size | Waist(in/cm) | Inseam(in/cm)"
    : "Size | Chest(in/cm) | Shoulder(in/cm) | Waist(in/cm) | Length(in/cm)";
  const rows = chart.map((c) => {
    if (isBottom) {
      return `${c.size} | ${c.waist_in[0]}-${c.waist_in[1]} / ${inToCm(c.waist_in[0])}-${inToCm(c.waist_in[1])} | ${c.length_in[0]}-${c.length_in[1]} / ${inToCm(c.length_in[0])}-${inToCm(c.length_in[1])}`;
    }
    return `${c.size} | ${c.chest_in[0]}-${c.chest_in[1]} / ${inToCm(c.chest_in[0])}-${inToCm(c.chest_in[1])} | ${c.shoulder_in[0]}-${c.shoulder_in[1]} / ${inToCm(c.shoulder_in[0])}-${inToCm(c.shoulder_in[1])} | ${c.waist_in[0]}-${c.waist_in[1]} / ${inToCm(c.waist_in[0])}-${inToCm(c.waist_in[1])} | ${c.length_in[0]}-${c.length_in[1]} / ${inToCm(c.length_in[0])}-${inToCm(c.length_in[1])}`;
  });
  return `BANGLADESH ${gender.toUpperCase()} ${productType.toUpperCase()} SIZE CHART (body measurements):\n${header}\n${rows.join("\n")}`;
}
