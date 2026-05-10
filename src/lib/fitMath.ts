import type { BodyMeasurement } from "./profile";

export type FitLevel = "Too Tight" | "Tight" | "Perfect" | "Loose" | "Too Loose" | "Unknown";

export interface FitResult {
  overallFit: FitLevel;
  chest: FitLevel;
  shoulder: FitLevel;
  waist: FitLevel;
  length: FitLevel;
  notes: string[];
}

export interface FitOptions {
  stretchFactor?: "low" | "medium" | "high";
  cutStyle?: string;
  shrinkageRisk?: "low" | "high";
  fastening?: "elastic" | "button" | "drawstring" | "unknown";
}

// Simple deterministic logic based on inches differences
export function calculateFit(body: Partial<BodyMeasurement>, garment: any, opts: FitOptions = {}): FitResult {
  const result: FitResult = {
    overallFit: "Unknown",
    chest: "Unknown",
    shoulder: "Unknown",
    waist: "Unknown",
    length: "Unknown",
    notes: [],
  };

  const getDiff = (g: any, b: any) => {
    const gVal = parseFloat(g);
    const bVal = parseFloat(b);
    if (isNaN(gVal) || isNaN(bVal)) return null;
    return gVal - bVal;
  };

  // Stretch factor affects how negative a diff can be before it's "Too Tight"
  const stretchOffset = opts.stretchFactor === "high" ? 1.5 : opts.stretchFactor === "medium" ? 0.5 : 0;

  const diffChest = getDiff(garment.chest_in, body.chest_in);
  if (diffChest !== null) {
    if (diffChest < (1 - stretchOffset)) result.chest = "Too Tight";
    else if (diffChest < (2.5 - stretchOffset)) result.chest = "Tight";
    else if (diffChest <= (4.5 + stretchOffset)) result.chest = "Perfect";
    else if (diffChest <= (6 + stretchOffset)) result.chest = "Loose";
    else result.chest = "Too Loose";
  }

  const diffShoulder = getDiff(garment.shoulder_in, body.shoulder_in);
  if (diffShoulder !== null) {
    const isDropShoulder = opts.cutStyle?.toLowerCase().includes("drop-shoulder") || opts.cutStyle?.toLowerCase().includes("oversized");
    
    if (diffShoulder < -0.5) result.shoulder = "Too Tight";
    else if (diffShoulder < 0) result.shoulder = "Tight";
    else if (diffShoulder <= 1.5) result.shoulder = "Perfect";
    else if (diffShoulder <= 2.5) result.shoulder = isDropShoulder ? "Perfect" : "Loose";
    else result.shoulder = isDropShoulder ? "Loose" : "Too Loose";
  }

  const diffWaist = getDiff(garment.waist_in, body.waist_in);
  if (diffWaist !== null) {
    const isElastic = opts.fastening === "elastic" || opts.fastening === "drawstring";
    const waistStretch = isElastic ? 2.5 : stretchOffset;

    if (diffWaist < (1 - waistStretch)) result.waist = "Too Tight";
    else if (diffWaist < (2 - waistStretch)) result.waist = "Tight";
    else if (diffWaist <= (4 + waistStretch)) result.waist = "Perfect";
    else if (diffWaist <= (6 + waistStretch)) result.waist = "Loose";
    else result.waist = "Too Loose";
  }

  // Length estimation (assuming standard torso lengths if not available)
  const diffLength = getDiff(garment.length_in, body.torso_length_in || ((parseFloat(body.height_estimate_in as any) || 68) * 0.38));
  if (diffLength !== null) {
    if (diffLength < -1) result.length = "Too Tight"; // Short
    else if (diffLength < 0.5) result.length = "Tight"; // Slightly short
    else if (diffLength <= 2.5) result.length = "Perfect";
    else if (diffLength <= 4) result.length = "Loose"; // Long
    else result.length = "Too Loose"; // Too long
  }

  const levels = [result.chest, result.shoulder, result.waist].filter((l) => l !== "Unknown");
  if (levels.length > 0) {
    if (levels.includes("Too Tight")) result.overallFit = "Too Tight";
    else if (levels.includes("Tight")) result.overallFit = "Tight";
    else if (levels.includes("Too Loose")) result.overallFit = "Too Loose";
    else if (levels.every((l) => l === "Perfect" || l === "Loose")) result.overallFit = "Perfect";
    else result.overallFit = "Loose";
  }

  if (result.chest === "Tight") {
    if (opts.shrinkageRisk === "high") {
      result.notes.push("The chest area is already tight, and high shrinkage risk means this might not fit after washing.");
    } else {
      result.notes.push("The chest area might feel a bit restrictive.");
    }
  } else if (result.chest === "Perfect" && opts.shrinkageRisk === "high" && diffChest !== null && diffChest < 3) {
    result.notes.push("Warning: Shrinkage risk is high, this 'Perfect' fit could become tight after one wash. Consider sizing up.");
  }
  
  if (result.shoulder === "Too Loose" && !opts.cutStyle?.toLowerCase().includes("drop-shoulder")) {
    result.notes.push("Shoulders will drop past your natural shoulder line.");
  }
  if (result.length === "Too Tight") result.notes.push("The garment is quite short and might ride up.");

  return result;
}
