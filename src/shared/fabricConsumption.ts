export type FabricEstimate = { widthInches: number; metresPerPiece: number; masterId?: string };
export type FabricConsumptionRate = FabricEstimate & { id: string; garment: string; size: string; gender: 'Boys' | 'Girls' | 'Common'; active: boolean };

const identity = (value: string) => value.trim().toLowerCase();

export function matchingFabricRates(rates: FabricConsumptionRate[], garment: string, size: string, gender: string) {
  const matches = rates.filter(rate => rate.active && identity(rate.garment) === identity(garment) && identity(rate.size) === identity(size) && (rate.gender === gender || rate.gender === 'Common'));
  const widths = Array.from(new Set(matches.map(rate => rate.widthInches))).sort((a, b) => a - b);
  return widths.map(width => matches.find(rate => rate.widthInches === width && rate.gender === gender) || matches.find(rate => rate.widthInches === width)!);
}

export function suggestedFabric(rates: FabricConsumptionRate[], garment: string, size: string, gender: string): FabricEstimate | undefined {
  const matches = matchingFabricRates(rates, garment, size, gender);
  if (matches.length !== 1) return undefined;
  const rate = matches[0];
  return { masterId: rate.id, widthInches: rate.widthInches, metresPerPiece: rate.metresPerPiece };
}

export function validateFabricEstimate(estimate: FabricEstimate) {
  if (!Number.isFinite(estimate.widthInches) || estimate.widthInches <= 0 || !Number.isFinite(estimate.metresPerPiece) || estimate.metresPerPiece <= 0) throw Error('Enter fabric width and metres per piece greater than zero.');
  return estimate;
}

export function saveFabricRate(rates: FabricConsumptionRate[], rate: FabricConsumptionRate) {
  validateFabricEstimate(rate);
  const clean = { ...rate, garment: rate.garment.trim(), size: rate.size.trim() };
  if (!clean.garment || !clean.size || !['Boys','Girls','Common'].includes(clean.gender)) throw Error('Select garment and gender, and enter a size.');
  if (rates.some(row => row.id !== clean.id && identity(row.garment) === identity(clean.garment) && identity(row.size) === identity(clean.size) && row.gender === clean.gender && row.widthInches === clean.widthInches)) throw Error('A fabric rate already exists for this garment, size, gender and width. Edit that rate.');
  return rates.some(row => row.id === clean.id) ? rates.map(row => row.id === clean.id ? clean : row) : [...rates, clean];
}

export const fabricMetres = (quantity: number, estimate: FabricEstimate) => Math.round(quantity * estimate.metresPerPiece * 1000) / 1000;
