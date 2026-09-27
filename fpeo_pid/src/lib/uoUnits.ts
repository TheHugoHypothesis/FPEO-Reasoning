import { UoUnit } from './types';
import uoUnitsJson from './uoUnits.json';

export const ALL_UO_UNITS: UoUnit[] = uoUnitsJson as UoUnit[];

const unitsByUri = new Map<string, UoUnit>();
const unitsById = new Map<string, UoUnit>();

for (const unit of ALL_UO_UNITS) {
    unitsByUri.set(unit.uri, unit);
    unitsById.set(unit.id, unit);
}

export function findUoUnit(uriOrId: string): UoUnit | undefined {
    if (!uriOrId) return undefined;
    if (unitsByUri.has(uriOrId)) return unitsByUri.get(uriOrId);
    if (unitsById.has(uriOrId)) return unitsById.get(uriOrId);
    const shortId = uriOrId.split('/').pop()?.split('#').pop() || uriOrId;
    if (unitsById.has(shortId)) return unitsById.get(shortId);
    return undefined;
}

export function resolveUoUnit(uriOrId: string): { label: string; short: string; uri: string } {
    const found = findUoUnit(uriOrId);
    if (found) {
        return { label: found.label, short: found.short, uri: found.uri };
    }
    const cleanId = uriOrId.split('/').pop()?.split('#').pop() || uriOrId;
    return {
        label: cleanId,
        short: cleanId,
        uri: uriOrId.startsWith('http') ? uriOrId : `http://purl.obolibrary.org/obo/${cleanId}`,
    };
}
