export type PortType = 'InletPort' | 'OutletPort' | 'ElectricalPort' | 'SignalPort';

export type EquipmentCategory =
  | 'CompressorEquipment'
  | 'PumpEquipment'
  | 'GasTurbineEquipment'
  | 'PressureVesselEquipment'
  | 'HeatExchangeEquipment'
  | 'SeparationAndFilterEquipment'
  | 'StorageAndPipingHeaderEquipment'
  | 'ValveAndSecurityEquipment'
  | 'ElectricalEquipment'
  | 'RenewableEquipment'
  | 'GenericEquipment';

export interface EquipmentPort {
  uri: string;
  shortUri: string;
  type: PortType;
  label?: string;
  equipmentUri: string;
  connectedToPortUri?: string;
}

export interface EquipmentTriple {
  subject: string;
  predicate: string;
  object: string;
}

export interface EquipmentComponent {
  uri: string;
  shortUri: string;
  label: string;
  predicate: string;
  typeUri?: string;
  typeLabel?: string;
  source: 'instance' | 'tbox';
}

export interface UoUnit {
  uri: string;
  id: string;
  label: string;
  short: string;
  definition?: string;
}

export interface EquipmentSpecification {
  id: string;
  uri: string;
  specTypeUri: string;
  specTypeLabel: string;
  valueExpressionUri: string;
  value: number | string;
  unitUri: string;
  unitLabel: string;
  unitShort: string;
}

export interface EquipmentDesign {
  documentUri: string;
  documentLabel: string;
  tagIdentifier?: string;
  modelIdentifier?: string;
  manufacturer?: string;
  designStandard?: string;
  specifications: EquipmentSpecification[];
}

export interface FpsoVessel {
  id: string;
  uri: string;
  classUri?: string;
  code: string;
  title: string;
  description?: string;
  fieldLocation?: string;
  isDefault?: boolean;
  specifications?: EquipmentSpecification[];
}

export interface FpsoModule {
  id: string;
  uri: string;
  classUri?: string;
  code: string;
  title: string;
  description?: string;
  fpsoId?: string;
  fpsoCode?: string;
  isDefault?: boolean;
  specifications?: EquipmentSpecification[];
}

export interface Equipment {
  uri: string;
  shortUri: string;
  label: string;
  classUri: string;
  classLabel: string;
  category: EquipmentCategory;
  ports: EquipmentPort[];
  triples: EquipmentTriple[];
  components: EquipmentComponent[];
  design?: EquipmentDesign;
  moduleUri?: string;
  moduleCode?: string;
  fpsoId?: string;
  fpsoCode?: string;
  hasError?: boolean;
  errorMessage?: string;
}

export interface PortConnection {
  id: string;
  sourceEquipmentUri: string;
  sourcePortUri: string;
  targetEquipmentUri: string;
  targetPortUri: string;
  connectionType: 'portConnectedTo' | 'feedsFluidToEquipment' | 'powersEquipment';
}

export interface OntologyClass {
  uri: string;
  shortUri: string;
  label: string;
  category: EquipmentCategory;
  description?: string;
  defaultPorts?: { type: PortType; label: string }[];
  defaultDesignSpecs?: {
    specTypeUri: string;
    specTypeLabel: string;
    defaultValue: number | string;
    unitUri: string;
    unitLabel: string;
    unitShort: string;
  }[];
}

export interface CreateEquipmentPayload {
  label: string;
  shortUri?: string;
  classUri: string;
  category?: EquipmentCategory;
  moduleUri?: string;
  moduleCode?: string;
  fpsoId?: string;
  fpsoCode?: string;
  ports: { type: PortType; label: string }[];
  components?: { label: string; classUri?: string }[];
  specifications?: {
    specTypeUri: string;
    specTypeLabel: string;
    value: number | string;
    unitUri: string;
    unitLabel: string;
    unitShort: string;
  }[];
  position?: { x: number; y: number };
}

export interface CreatePortPayload {
  equipmentUri: string;
  type: PortType;
  label: string;
}

export interface OntologyGraph {
  equipments: Equipment[];
  connections: PortConnection[];
  availableClasses: OntologyClass[];
  fpsos?: FpsoVessel[];
  modules?: FpsoModule[];
  uoUnits?: UoUnit[];
  rawTriplesCount: number;
  filesLoaded: string[];
}

export interface InconsistencyJustification {
  id: string;
  title: string;
  tboxAxioms: string[];
  aboxTriples: string[];
  involvedEquipmentUris: string[];
  severity: 'error' | 'warning';
}

export interface AuditResult {
  isConsistent: boolean;
  status: 'valid' | 'inconsistent' | 'error';
  justifications: InconsistencyJustification[];
  llmExplanation?: string;
  timestamp: string;
}

export type LLMProvider = 'gemini' | 'ollama' | 'none';

export interface AppSettings {
  llmProvider: LLMProvider;
  geminiApiKey: string;
  geminiModel: string;
  ollamaUrl: string;
  ollamaModel: string;
  backendUrl: string;
  autoAuditOnLoad: boolean;
  themeMode?: 'dark' | 'light';
  hasCompletedOnboarding?: boolean;
}
