from pathlib import Path
import csv, json, re, hashlib, xml.etree.ElementTree as ET
from rdflib import Graph, RDF, RDFS, OWL, URIRef
from jsonschema import Draft202012Validator, FormatChecker

ROOT=Path(__file__).resolve().parent
PROD=ROOT/'PRODUCTION_BASELINE'; CAND=ROOT/'CANDIDATE_JSON'; REPORTS=ROOT/'REPORTS'
EQ='http://www.usp.ai/Ontologies/FPEO/EquipmentModule#'
POWER='http://www.usp.ai/Ontologies/FPEO/PowerModule.rdf#'
PLM='http://rds.posccaesar.org/ontology/plm/rdl/'
O3='https://www.inf.ufrgs.br/ontologies/o3po#'
BFO19='http://purl.obolibrary.org/obo/bfo/2019-08-26/bfo.owl'
BFO20='http://purl.obolibrary.org/obo/bfo/2020/bfo.owl'

results=[]
def check(name, ok, detail):
    results.append((name,'PASS' if ok else 'FAIL',detail)); print(('PASS ' if ok else 'FAIL ')+name+': '+detail)
    return ok

def parse(path):
    g=Graph(); g.parse(path,format='xml'); return g

# 1 parse and roundtrip
cand_rdfs=sorted(CAND.glob('*.rdf'))
for p in cand_rdfs:
    try:
        g=parse(p); tmp=REPORTS/('_roundtrip_'+p.name); g.serialize(tmp,format='xml'); g2=parse(tmp); tmp.unlink()
        check('RDF parse/roundtrip '+p.name, len(g)==len(g2), f'{len(g)} triples; roundtrip {len(g2)}')
    except Exception as e: check('RDF parse/roundtrip '+p.name,False,repr(e))

# 2 baseline fingerprints
base_eq=parse(PROD/'EquipmentModule.rdf'); cand_eq=parse(CAND/'EquipmentModule.rdf')
base_off=parse(PROD/'OffshoreFacilityModule.rdf'); cand_off=parse(CAND/'OffshoreFacilityModule.rdf')

def count_type(g, cls): return len(set(g.subjects(RDF.type,URIRef(cls))))
for label,cls,expected in [
 ('ElectricalBus',EQ+'ElectricalBus',35),('SolarPanel',EQ+'SolarPanel',35),('WindTurbine',EQ+'WindTurbine',35),
 ('PLM GasTurbine',PLM+'PCA_100005927',35),('PLM PowerCable',PLM+'PCA_100004105',35)]:
    b=count_type(base_eq,cls); c=count_type(cand_eq,cls); check('Fingerprint '+label,c==b==expected,f'baseline={b}, candidate={c}, expected={expected}')
b=count_type(base_off,O3+'FPSO'); c=count_type(cand_off,O3+'FPSO'); check('Fingerprint O3PO FPSO',c==b==36,f'baseline={b}, candidate={c}, expected=36')

# Exact baseline individual IRIs for compatibility classes are retained
classes=[EQ+'ElectricalBus',EQ+'SolarPanel',EQ+'WindTurbine',PLM+'PCA_100005927',PLM+'PCA_100004105']
for cls in classes:
    b=set(base_eq.subjects(RDF.type,URIRef(cls))); c=set(cand_eq.subjects(RDF.type,URIRef(cls)))
    check('IRI set '+cls.split('#')[-1].split('/')[-1],b==c,f'{len(b)} baseline IRIs == {len(c)} candidate IRIs')
check('IRI set FPSO',set(base_off.subjects(RDF.type,URIRef(O3+'FPSO')))==set(cand_off.subjects(RDF.type,URIRef(O3+'FPSO'))),'36 platform IRIs retained')

# Legacy assertions retained: baseline graph excluding ontology header/import and changed PowerCable superclass must be subset candidate
removed_allowed={(URIRef('http://www.usp.ai/Ontologies/FPEO/EquipmentModule'),OWL.imports,URIRef(BFO19)),(URIRef(EQ+'PowerCable'),RDFS.subClassOf,URIRef(PLM+'PCA_100004062'))}
missing=[]
for t in base_eq:
    if t in removed_allowed: continue
    if t not in cand_eq: missing.append(t)
check('Equipment additive preservation',not missing,f'missing baseline triples (excluding 2 deliberate refactor triples)={len(missing)}')

# BFO policy
onts=list(cand_eq.subjects(RDF.type,OWL.Ontology)); imps=set(cand_eq.objects(onts[0],OWL.imports))
base_onts=list(base_eq.subjects(RDF.type,OWL.Ontology)); base_imps=set(base_eq.objects(base_onts[0],OWL.imports))
check('Production baseline remains BFO 2019',URIRef(BFO19) in base_imps,'original immutable Equipment baseline still imports BFO 2019')
check('Candidate Equipment uses BFO 2020',URIRef(BFO20) in imps and URIRef(BFO19) not in imps,'candidate imports BFO 2020 and not 2019')

# 3 portable catalog + import closure resolution
cat=ET.parse(CAND/'catalog-v001.xml').getroot(); ns={'c':'urn:oasis:names:tc:entity:xmlns:xml:catalog'}
entries={u.attrib['name']:u.attrib['uri'] for u in cat.findall('c:uri',ns)}
check('Catalog has no absolute file URI',all(not v.startswith('file:') and not v.startswith('/') for v in entries.values()),f'{len(entries)} portable entries')
check('Power IRI alias present',entries.get('http://www.usp.ai/Ontologies/FPEO/PowerModule')=='PowerModule.rdf' and entries.get('http://www.usp.ai/Ontologies/FPEO/PowerModule.rdf')=='PowerModule.rdf','both historical logical forms resolve locally')
local_onts={}
for p in cand_rdfs:
    g=parse(p)
    for o in g.subjects(RDF.type,OWL.Ontology): local_onts[str(o)]=p.name
unresolved=[]
external_allowed_prefixes=('http://purl.obolibrary.org/obo/bfo/2020/bfo.owl','https://www.inf.ufrgs.br/ontologies/o3po/','https://spec.industrialontologies.org/')
for p in cand_rdfs:
    g=parse(p)
    for o in g.subjects(RDF.type,OWL.Ontology):
        for imp in g.objects(o,OWL.imports):
            s=str(imp)
            if s in local_onts or s in entries or s.startswith(external_allowed_prefixes): continue
            unresolved.append((p.name,s))
check('Candidate local import closure',not unresolved,'all local imports resolvable by ontology identity/catalog; external BFO/O3PO imports intentionally remain external')

# 4 three software-discovered Power properties exactly once globally by local name
gall=Graph()
for p in cand_rdfs:
    for t in parse(p): gall.add(t)
for ln in ['hasConnectedBus','hasConnectedEquipment','isConnectedToOther_BUS_ByCable']:
    xs=set(s for s in gall.subjects(RDF.type,OWL.ObjectProperty) if str(s).split('#')[-1]==ln)
    check('Unique Power ObjectProperty '+ln,len(xs)==1,f'{len(xs)} declaration(s): '+', '.join(map(str,xs)))

# 5 no anonymous class expressions in candidate-authored app-critical layers
critical=['EquipmentModule.rdf','PowerModule.rdf','FPSO_ScenarioModule.rdf','MeasurementTemporalModule.rdf','EmissionProcessModule.rdf','CombustionProcessModule.rdf','FlaringProcessModule.rdf','VentingProcessModule.rdf','FugitiveEmissionModule.rdf']
for fn in critical:
    g=parse(CAND/fn)
    bad=sum(1 for s,p,o in g if p in [OWL.complementOf,OWL.intersectionOf,OWL.unionOf] or (p==RDF.type and o==OWL.Restriction))
    check('HermiT-safe named hierarchy '+fn,bad==0,f'anonymous/restriction constructs={bad}; named equivalentClass/disjointWith are permitted legacy OWL-DL axioms')

# 6 comments on all candidate local class/object/datatype properties
local_prefixes=('http://www.usp.ai/Ontologies/FPEO/',)
missing_comments=[]
for p in cand_rdfs:
    if p.name == 'OffshoreFacilityModule.rdf':
        continue  # deliberately unchanged production module; do not manufacture annotations in the refactor
    g=parse(p)
    for typ in [OWL.Class,OWL.ObjectProperty,OWL.DatatypeProperty]:
        for s in set(g.subjects(RDF.type,typ)):
            if str(s).startswith(local_prefixes) and not list(g.objects(s,RDFS.comment)): missing_comments.append((p.name,str(s)))
check('rdfs:comment coverage local vocabulary',not missing_comments,f'missing comments={len(missing_comments)}')

# 7 local entity reference declaration hygiene
local_ns=('http://www.usp.ai/Ontologies/FPEO/EquipmentModule#','http://www.usp.ai/Ontologies/FPEO/PowerModule.rdf#','http://www.usp.ai/Ontologies/FPEO/FPSO-ScenarioModule#','http://www.usp.ai/Ontologies/FPEO/MeasurementTemporalModule#','http://www.usp.ai/Ontologies/FPEO/EmissionProcessModule#','http://www.usp.ai/Ontologies/FPEO/CombustionProcessModule#','http://www.usp.ai/Ontologies/FPEO/FlaringProcessModule#','http://www.usp.ai/Ontologies/FPEO/VentingProcessModule#','http://www.usp.ai/Ontologies/FPEO/FugitiveEmissionModule#')
declared=set()
for typ in [OWL.Class,OWL.ObjectProperty,OWL.DatatypeProperty,OWL.NamedIndividual]: declared |= set(gall.subjects(RDF.type,typ))
used=set()
for s,p,o in gall:
    for x in [s,p,o]:
        if isinstance(x,URIRef) and str(x).startswith(local_ns): used.add(x)
undefined=[str(x) for x in used if x not in declared and x not in set(gall.subjects(RDF.type,OWL.Ontology))]
# subjects used as individuals may lack owl:NamedIndividual in legacy files, so only flag predicate/class-position undefined
undefined_strict=[]
for s,p,o in gall:
    if isinstance(p,URIRef) and str(p).startswith(local_ns) and p not in declared: undefined_strict.append(str(p))
    if p in [RDF.type,RDFS.subClassOf,RDFS.domain,RDFS.range] and isinstance(o,URIRef) and str(o).startswith(local_ns) and o not in declared: undefined_strict.append(str(o))
check('Local vocabulary declaration hygiene',not undefined_strict,f'undefined predicate/class references={len(set(undefined_strict))}')

# 8 73-field ledger and actual entity declarations
rows=list(csv.DictReader(open(REPORTS/'JSON_73_COVERAGE.csv')))
check('Official JSON field count',len(rows)==73,f'ledger fields={len(rows)}')
check('JSON 73 semantic mapping completeness',all(r['status']=='IMPLEMENTED' and r['ontology_entity'] for r in rows),f"implemented={sum(r['status']=='IMPLEMENTED' for r in rows)}/73")
# verify all explicit CURIE-like local entities appearing in ledger exist, ignoring compound textual mappings and rdf:type/O3PO
prefix_map={'EQ':'http://www.usp.ai/Ontologies/FPEO/EquipmentModule#','POWER':'http://www.usp.ai/Ontologies/FPEO/PowerModule.rdf#','FPSO':'http://www.usp.ai/Ontologies/FPEO/FPSO-ScenarioModule#','MT':'http://www.usp.ai/Ontologies/FPEO/MeasurementTemporalModule#','EM':'http://www.usp.ai/Ontologies/FPEO/EmissionProcessModule#','COMB':'http://www.usp.ai/Ontologies/FPEO/CombustionProcessModule#'}
missing_ledger=[]
for r in rows:
    for pref,local in re.findall(r'\b(EQ|POWER|FPSO|MT|EM|COMB):([A-Za-z_][A-Za-z0-9_-]*)',r['ontology_entity']):
        iri=URIRef(prefix_map[pref]+local)
        if iri not in used and iri not in declared: missing_ledger.append((r['json_path'],str(iri)))
check('JSON ledger entities exist in RDF',not missing_ledger,f'missing referenced ontology entities={len(missing_ledger)}')

# 9 official JSON schema validation with complete representative payload
schema=json.load(open(CAND/'schema_in.json'))
validator=Draft202012Validator(schema,format_checker=FormatChecker())
sample={
'name':'V5 comprehensive validation scenario','description':'Exercises every schema branch and top-level collection.',
'fuels':[{'key':'ng','name':'Natural Gas','cost_per_gram_usd':0.0005,'emissions':[{'name':'Carbon Dioxide','formula':'CO2','gwp':1,'ecf':2.75}]}],
'platforms':[{'id':'P-1'},{'id':'P-2'}],
'buses':[{'id':'BUS-1','fpso_id':'P-1','distribution_efficiency':0.98,'load_sharing_strategy':'merit_order'},{'id':'BUS-2','fpso_id':'P-2'}],
'alternative_sources':[{'id':'WIND-1','model':'WT-15','max_power':15000000,'energy_unit_cost':1e-8,'ECF':0.0,'generator_efficiency':0.95,'transmission_efficiency':0.98,'acquisition_cost':1,'maintenance_cost':1}],
'gas_turbines':[{'id':'GT-1','model':'LM2500','max_power':25000000,'fuel_key':'ng','SFC':1e-7,'generator_efficiency':0.95,'transmission_efficiency':0.99,'acquisition_cost':1,'maintenance_cost':1}],
'cables':[{'id':'CABLE-1','from_bus':'BUS-1','to_bus':'BUS-2','max_capacity':50000000,'transmission_efficiency':0.97,'acquisition_cost':1,'maintenance_cost':1}],
'source_connections':[{'source_id':'GT-1','bus_id':'BUS-1'},{'source_id':'WIND-1','bus_id':'BUS-1'}],
'consumer_connections':[{'consumer_id':'P-1','bus_id':'BUS-1'},{'consumer_id':'P-2','bus_id':'BUS-2'}],
'demand_periods':[
 {'start_date':'2026-01-01','end_date':'2027-01-01','bus_id':'BUS-1','active_source_ids':['GT-1','WIND-1'],'local_demand':{'type':'constant','demand_watts':10000000},'remote_demands':{'P-2':{'type':'field_lifecycle','start_year':2026,'ramp_up_years':1,'plateau_demand_watts':8000000,'plateau_years':2,'decline_rate':0.1,'initial_demand_watts':1000000}}},
 {'start_date':'2027-01-01','end_date':'2028-01-01','bus_id':'BUS-2','local_demand':{'type':'keyframe','breakpoints':[{'year':2027,'demand_watts':5000000},{'year':2028,'demand_watts':4000000}], 'connections':['linear']}}
]
}
errs=list(validator.iter_errors(sample)); check('Official JSON comprehensive sample',not errs,'0 schema errors' if not errs else '; '.join(e.message for e in errs[:3]))
(REPORTS/'official_schema_comprehensive_sample.json').write_text(json.dumps(sample,indent=2))
invalids=[
 ('reject additional property',{**sample,'bogus':1}),
 ('reject efficiency > 1',{**sample,'alternative_sources':[{**sample['alternative_sources'][0],'generator_efficiency':1.1}]}),
 ('reject bad load strategy',{**sample,'buses':[{**sample['buses'][0],'load_sharing_strategy':'random'}]}),
 ('reject one-point keyframe',{**sample,'demand_periods':[{'start_date':'2027-01-01','end_date':'2028-01-01','bus_id':'BUS-2','local_demand':{'type':'keyframe','breakpoints':[{'year':2027,'demand_watts':1}], 'connections':[]}}]}),
 ('reject missing required alternative-source id',{**sample,'alternative_sources':[{k:v for k,v in sample['alternative_sources'][0].items() if k!='id'}]}),
]
for name,payload in invalids:
    check('JSON negative '+name,bool(list(validator.iter_errors(payload))),'invalid payload correctly rejected')

# 10 no file:// imports in candidate RDF text
bad_file=[]
for p in cand_rdfs:
    text=p.read_text(errors='ignore')
    if re.search(r'owl:imports[^>]+(?:file:|/home/|/mnt/)',text): bad_file.append(p.name)
check('No filesystem-specific owl:imports',not bad_file,'candidate imports are logical IRIs only')

# Write report
passes=sum(s=='PASS' for _,s,_ in results); fails=sum(s=='FAIL' for _,s,_ in results)
with open(REPORTS/'AUTOMATED_VALIDATION_REPORT.txt','w') as f:
    f.write('FPEO V5 AUTOMATED VALIDATION REPORT\n')
    f.write(f'PASS={passes} FAIL={fails}\n\n')
    for n,s,d in results: f.write(f'[{s}] {n}\n  {d}\n')
    f.write('\nNOT EXECUTED IN THIS ENVIRONMENT\n')
    f.write('- Owlready2 local-load regression: package not installed and bounded pip installation failed because this runtime has no package-network access.\n')
    f.write('- HermiT semantic reasoner: no HermiT/ROBOT/Protégé reasoner executable or jar is installed. Structural HermiT-safety checks were executed, but this is not a substitute for a reasoner run.\n')
    f.write('- Protégé GUI import-closure test: Protégé is not installed/available as an interactive GUI in this runtime. Portable catalog and logical import closure were checked structurally.\n')
    f.write('- Selenium GUI test: not run because this architecture package does not include the user application/GUI endpoint; Chromium alone is insufficient to test the ontology application path.\n')
    f.write('\nKNOWN OPEN ISSUES TO OBSERVE\n')
    f.write('- Historical PowerModule ontology identity ends in .rdf while older imports/catalogs also use the no-.rdf form. Candidate preserves the public .rdf ontology IRI and provides both catalog aliases.\n')
    f.write('- Candidate Equipment intentionally moves from production BFO 2019 import to BFO 2020; production baseline is retained untouched for regression comparison.\n')
    f.write('- External BFO 2020 and O3PO imports are logical network IRIs; this package does not bundle third-party ontology copies. Protégé must resolve them via its normal catalog/import mechanism or a local institutional mirror.\n')
    f.write('- JSON cross-reference integrity (e.g. source_id actually names an element in gas_turbines/alternative_sources) is not enforced by JSON Schema itself and belongs in application/SHACL validation.\n')
print(f'\nTOTAL PASS={passes} FAIL={fails}')
raise SystemExit(1 if fails else 0)
