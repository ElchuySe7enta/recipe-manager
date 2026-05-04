// Unit-conversion: maps known units to a base unit per dimension (g for mass,
// mL for volume, pcs for count). Unknown units pass through as their own
// pseudo-dimension so behavior stays predictable.
const UNIT_DEFS = {
  // mass → g
  mg: { dim: "mass", toBase: 0.001 }, g: { dim: "mass", toBase: 1 },
  gram: { dim: "mass", toBase: 1 }, grams: { dim: "mass", toBase: 1 },
  kg: { dim: "mass", toBase: 1000 },
  oz: { dim: "mass", toBase: 28.3495 }, lb: { dim: "mass", toBase: 453.592 }, lbs: { dim: "mass", toBase: 453.592 },
  // volume → mL
  ml: { dim: "volume", toBase: 1 }, l: { dim: "volume", toBase: 1000 },
  liter: { dim: "volume", toBase: 1000 }, liters: { dim: "volume", toBase: 1000 },
  litre: { dim: "volume", toBase: 1000 }, litres: { dim: "volume", toBase: 1000 },
  tsp: { dim: "volume", toBase: 4.92892 }, teaspoon: { dim: "volume", toBase: 4.92892 }, teaspoons: { dim: "volume", toBase: 4.92892 },
  tbsp: { dim: "volume", toBase: 14.7868 }, tablespoon: { dim: "volume", toBase: 14.7868 }, tablespoons: { dim: "volume", toBase: 14.7868 },
  cup: { dim: "volume", toBase: 236.588 }, cups: { dim: "volume", toBase: 236.588 },
  "fl oz": { dim: "volume", toBase: 29.5735 }, floz: { dim: "volume", toBase: 29.5735 },
  // count → pcs
  "": { dim: "count", toBase: 1 },
  pc: { dim: "count", toBase: 1 }, pcs: { dim: "count", toBase: 1 },
  piece: { dim: "count", toBase: 1 }, pieces: { dim: "count", toBase: 1 },
  each: { dim: "count", toBase: 1 }, ea: { dim: "count", toBase: 1 },
  unit: { dim: "count", toBase: 1 }, units: { dim: "count", toBase: 1 },
};

export const UNIT_SUGGESTIONS = ["g", "kg", "mg", "oz", "lb", "mL", "L", "tsp", "tbsp", "cup", "fl oz", "pcs", "each", "piece"];

export const normUnit = (u) => (u || "").trim().toLowerCase();
export const unitInfo = (u) => UNIT_DEFS[normUnit(u)] || null;
export const dimensionOf = (u) => {
  const info = unitInfo(u);
  return info ? info.dim : (normUnit(u) || "count");
};
export const toBase = (qty, unit) => {
  const n = Number(qty) || 0;
  const info = unitInfo(unit);
  return info ? n * info.toBase : n;
};
export const fromBase = (baseQty, unit) => {
  const info = unitInfo(unit);
  return info ? baseQty / info.toBase : baseQty;
};
export const formatBase = (baseQty, dim) => {
  const round = (n) => Math.round(n * 100) / 100;
  if (dim === "mass") {
    if (Math.abs(baseQty) >= 1000) return { value: round(baseQty / 1000), unit: "kg" };
    return { value: round(baseQty), unit: "g" };
  }
  if (dim === "volume") {
    if (Math.abs(baseQty) >= 1000) return { value: round(baseQty / 1000), unit: "L" };
    return { value: round(baseQty), unit: "mL" };
  }
  if (dim === "count") return { value: round(baseQty), unit: "pcs" };
  return { value: round(baseQty), unit: dim };
};
export const ingredientKey = (name, unit) =>
  `${(name || "").trim().toLowerCase()}|${dimensionOf(unit)}`;
