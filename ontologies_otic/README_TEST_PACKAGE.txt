FPEO V5 JSON-COMPATIBLE TEST PACKAGE
Generated: 2026-08-21

PRODUCTION_BASELINE/ contains exact immutable copies supplied by the user.
CANDIDATE_JSON/ contains the new architecture. Never place baseline and candidate RDFs in the same Owlready2 import directory because logical ontology identities overlap by design.

Candidate import architecture:
OperationalScenario.rdf
  -> FPSO_ScenarioModule.rdf
      -> PowerModule.rdf
          -> EquipmentModule.rdf
          -> OffshoreFacilityModule.rdf
          -> MeasurementTemporalModule.rdf
      -> EmissionProcessModule.rdf -> MeasurementTemporalModule.rdf
      -> CombustionProcessModule.rdf -> EmissionProcessModule.rdf + EquipmentModule.rdf
      -> FlaringProcessModule.rdf -> EmissionProcessModule.rdf
      -> VentingProcessModule.rdf -> EmissionProcessModule.rdf
      -> FugitiveEmissionModule.rdf -> EmissionProcessModule.rdf

BFO policy:
- production Equipment baseline remains BFO 2019 exactly as supplied;
- candidate Equipment V5 imports BFO 2020;
- newly created modules are BFO 2020 aligned with named-class hierarchies and no anonymous restrictions/equivalentClass/disjointness.

PowerModule historical logical IRI remains .../PowerModule.rdf. The portable catalog also aliases .../PowerModule to the same local file to absorb the historical mismatch.
