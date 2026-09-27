import csv
import time
from agent import ask_fpeo_agent

# ==============================================================================
# BATERIA DE QUESTÕES DE COMPETÊNCIA MAPEADAS AO DOC-SPEC (RF01 A RF42)
# ==============================================================================
COMPETENCY_QUESTIONS = [
    # --- SUBDOMÍNIO: CORE ---
    {"rf_id": "RF01", "subdomain": "Core", "question": "Which module is the K-01 compressor located in?"},
    {"rf_id": "RF02", "subdomain": "Core", "question": "Which physical ports belong to equipment K-01?"},
    {"rf_id": "RF03", "subdomain": "Core", "question": "Which equipment receives fluid from compressor K-01?"},
    {"rf_id": "RF24", "subdomain": "Core", "question": "Which modules are located on FPSO P-78?"},
    {"rf_id": "RF24", "subdomain": "Core", "question": "Which modules are located on FPSO P-79?"},
    {"rf_id": "RF25", "subdomain": "Core", "question": "Which equipment (or equipments) is in the same module as GTG-01?"},
    {"rf_id": "RF25", "subdomain": "Core", "question": "Which equipment (or equipments) is in the same module as compressor K-02?"},
    {"rf_id": "RF25", "subdomain": "Core", "question": "Which equipment (or equipments) is in the same module as pump P-01?"},
    {"rf_id": "RF25", "subdomain": "Core", "question": "Which equipment (or equipments) is in the same module as emergency generator EDG-01?"},
    {"rf_id": "RF26", "subdomain": "Core", "question": "Which equipment has the F01_Port_In port?"},
    {"rf_id": "RF26", "subdomain": "Core", "question": "Which equipment has the E01_Port_In port?"},
    {"rf_id": "RF26", "subdomain": "Core", "question": "Which equipment has the V01_Port_In port?"},
    {"rf_id": "RF26", "subdomain": "Core", "question": "Which equipment has the P02_Port_In port?"},
    {"rf_id": "RF27", "subdomain": "Core", "question": "Which equipment is connected to the outlet of filter F-01?"},
    {"rf_id": "RF27", "subdomain": "Core", "question": "Which equipment is connected to the outlet of heater E-02?"},
    {"rf_id": "RF27", "subdomain": "Core", "question": "Which equipment is connected to the outlet of separator V-01?"},
    {"rf_id": "RF27", "subdomain": "Core", "question": "Which equipment is connected to the outlet of compressor K-01?"},
    {"rf_id": "RF27", "subdomain": "Core", "question": "Which equipment receives the outlet of pump P-01?"},
    {"rf_id": "RF28", "subdomain": "Core", "question": "Which equipment has the identifier P-01?"},
    {"rf_id": "RF28", "subdomain": "Core", "question": "Which equipment has the identifier F-01?"},
    {"rf_id": "RF28", "subdomain": "Core", "question": "Which equipment has the identifier E-01?"},
    {"rf_id": "RF28", "subdomain": "Core", "question": "Which equipment has the identifier E-02?"},
    {"rf_id": "RF28", "subdomain": "Core", "question": "Which equipment has the identifier V-01?"},
    {"rf_id": "RF28", "subdomain": "Core", "question": "Which equipment has the identifier P-02?"},
    {"rf_id": "RF28", "subdomain": "Core", "question": "Which equipment has the identifier K-01?"},
    {"rf_id": "RF28", "subdomain": "Core", "question": "Which equipment has the identifier K-02?"},
    {"rf_id": "RF28", "subdomain": "Core", "question": "Which equipment has the identifier GTG-01?"},
    {"rf_id": "RF28", "subdomain": "Core", "question": "Which equipment has the identifier SWG-HV-01?"},

    # --- SUBDOMÍNIO: STATIC ---
    {"rf_id": "RF04", "subdomain": "Static", "question": "Which pressure separation vessels are present in the topside process plant?"},
    {"rf_id": "RF05", "subdomain": "Static", "question": "Which heat exchangers receive process flow originating from pump P-01?"},
    {"rf_id": "RF06", "subdomain": "Static", "question": "Which equipment receives treated water discharged from hydrocyclone H-01?"},
    {"rf_id": "RF07", "subdomain": "Static", "question": "Which downstream equipment is connected to the outlet of flare tip FL-01?"},
    {"rf_id": "RF08", "subdomain": "Static", "question": "Which drain headers receive fluid from hazardous open drain headers?"},

    # --- SUBDOMÍNIO: DYNAMICAL ---
    {"rf_id": "RF09", "subdomain": "Dynamical", "question": "Which gas compressors are located in module M-02?"},
    {"rf_id": "RF10", "subdomain": "Dynamical", "question": "Which strainer or filter receives fluid discharged from seawater lift pump P-01?"},
    {"rf_id": "RF11", "subdomain": "Dynamical", "question": "Which compressor receives compressed gas discharged from VRU compressor K-01?"},
    {"rf_id": "RF12", "subdomain": "Dynamical", "question": "Which flare knockout drums receive discharge lines from high-pressure compressors?"},
    {"rf_id": "RF33", "subdomain": "Dynamical", "question": "What are the components of GTG-01?"},
    {"rf_id": "RF34", "subdomain": "Dynamical", "question": "How many internal components does GTG-01 have?"},
    {"rf_id": "RF35", "subdomain": "Dynamical", "question": "Which shaft is part of GTG-01?"},
    {"rf_id": "RF35", "subdomain": "Dynamical", "question": "Which combustion chamber is part of GTG-01?"},

    # --- SUBDOMÍNIO: ELECTRICAL ---
    {"rf_id": "RF13", "subdomain": "Electrical", "question": "Which electric driver motors are registered in the topside facility?"},
    {"rf_id": "RF14", "subdomain": "Electrical", "question": "Which main turbine generators supply electrical power to high-voltage switchgear SWG-HV-01?"},
    {"rf_id": "RF15", "subdomain": "Electrical", "question": "Which electric motors are powered through variable speed drives?"},
    {"rf_id": "RF16", "subdomain": "Electrical", "question": "Which switchgear or switchboard is directly powered by emergency diesel generator EDG-01?"},
    {"rf_id": "RF29", "subdomain": "Electrical", "question": "Which equipment does GTG-01 directly power?"},
    {"rf_id": "RF29", "subdomain": "Electrical", "question": "Which equipment does SWG-HV-01 directly power?"},
    {"rf_id": "RF29", "subdomain": "Electrical", "question": "Which equipment does TR-01 directly power?"},
    {"rf_id": "RF29", "subdomain": "Electrical", "question": "Which equipment does MCC-01 directly power?"},
    {"rf_id": "RF29", "subdomain": "Electrical", "question": "Which equipment does EDG-01 directly power?"},
    {"rf_id": "RF30", "subdomain": "Electrical", "question": "Which equipment directly powers SWG-HV-01?"},
    {"rf_id": "RF30", "subdomain": "Electrical", "question": "Which equipment directly powers TR-01?"},
    {"rf_id": "RF30", "subdomain": "Electrical", "question": "Which equipment directly powers MCC-01?"},
    {"rf_id": "RF31", "subdomain": "Electrical", "question": "What is the electrical power path from GTG-01 to MCC-01?"},
    {"rf_id": "RF32", "subdomain": "Electrical", "question": "What is the electrical power path from GTG-01 to motor M-P01?"},

    # --- SUBDOMÍNIO: INSTRUMENTATION & CONTROL ---
    {"rf_id": "RF17", "subdomain": "Instrumentation & Control", "question": "Which continuous flue gas analyzers are installed at the exhaust stacks of turbine GTG-01?"},
    {"rf_id": "RF18", "subdomain": "Instrumentation & Control", "question": "Which continuous supervisory sensors monitor operational parameters of compressor K-01?"},
    {"rf_id": "RF19", "subdomain": "Instrumentation & Control", "question": "Which sensors and detectors are associated with turbine generator GTG-01?"},

    # --- SUBDOMÍNIO: VALVE & SECURITY ---
    {"rf_id": "RF20", "subdomain": "Valve & Security", "question": "Which pressure safety and relief valves are registered in the gas modules?"},
    {"rf_id": "RF21", "subdomain": "Valve & Security", "question": "Which emergency shutdown valves are allocated on the inlet feed line of separator V-01?"},

    # --- SUBDOMÍNIO: RENEWABLE ---
    {"rf_id": "RF22", "subdomain": "Renewable", "question": "Which waste heat recovery units operate in the topside facility?"},
    {"rf_id": "RF23", "subdomain": "Renewable", "question": "What is the rated power of solar panel PV-01?"},

    # --- SUBDOMÍNIO: PROPERTIES & METROLOGY ---
    {"rf_id": "RF36", "subdomain": "Properties & Metrology", "question": "What is the rated power of pump P-01?"},
    {"rf_id": "RF36", "subdomain": "Properties & Metrology", "question": "What is the rated power of pump P-02?"},
    {"rf_id": "RF36", "subdomain": "Properties & Metrology", "question": "What is the rated power of compressor K-01?"},
    {"rf_id": "RF36", "subdomain": "Properties & Metrology", "question": "What is the rated power of compressor K-02?"},
    {"rf_id": "RF36", "subdomain": "Properties & Metrology", "question": "What is the rated power of GTG-01?"},
    {"rf_id": "RF37", "subdomain": "Properties & Metrology", "question": "What is the design pressure of pump P-01?"},
    {"rf_id": "RF37", "subdomain": "Properties & Metrology", "question": "What is the design pressure of filter F-01?"},
    {"rf_id": "RF37", "subdomain": "Properties & Metrology", "question": "What is the design pressure of heat exchanger E-01?"},
    {"rf_id": "RF37", "subdomain": "Properties & Metrology", "question": "What is the design pressure of separator V-01?"},
    {"rf_id": "RF37", "subdomain": "Properties & Metrology", "question": "What is the design pressure of compressor K-01?"},
    {"rf_id": "RF37", "subdomain": "Properties & Metrology", "question": "What is the design pressure of compressor K-02?"},
    {"rf_id": "RF38", "subdomain": "Properties & Metrology", "question": "What is the design flow rate of pump P-01?"},
    {"rf_id": "RF38", "subdomain": "Properties & Metrology", "question": "What is the design flow rate of compressor K-02?"},
    {"rf_id": "RF39", "subdomain": "Properties & Metrology", "question": "What is the thermal duty of heat exchanger E-01?"},
    {"rf_id": "RF39", "subdomain": "Properties & Metrology", "question": "What is the thermal duty of heater E-02?"},
    {"rf_id": "RF40", "subdomain": "Properties & Metrology", "question": "What is the design temperature of separator V-01?"},
    {"rf_id": "RF41", "subdomain": "Properties & Metrology", "question": "What is the rated speed of GTG-01?"},
    {"rf_id": "RF42", "subdomain": "Properties & Metrology", "question": "What is the efficiency of GTG-01?"},
    {"rf_id": "RF42", "subdomain": "Properties & Metrology", "question": "What is the turbine inlet temperature of GTG-01?"}
]


# ==============================================================================
# PIPELINE DE EXECUÇÃO E EXPORTAÇÃO DE RESULTADOS
# ==============================================================================
def run_benchmark():
    results = []
    print(f"\n[BENCHMARK] Iniciando execução de {len(COMPETENCY_QUESTIONS)} Questões de Competência...")
    start_total = time.time()

    for idx, item in enumerate(COMPETENCY_QUESTIONS, 1):
        rf_id = item["rf_id"]
        subdomain = item["subdomain"]
        nlq = item["question"]

        print(f"\n>>> [{idx}/{len(COMPETENCY_QUESTIONS)}] Requisito: {rf_id} ({subdomain})")
        t0 = time.time()
        ret_data = ask_fpeo_agent(nlq)
        elapsed = round(time.time() - t0, 2)

        status = "SUCCESS" if ret_data else "FAILED"
        results.append({
            "RF_ID": rf_id,
            "Subdomain": subdomain,
            "Question": nlq,
            "Status": status,
            "Results": str(ret_data) if ret_data else "[]",
            "ExecutionTime_s": elapsed
        })

    total_time = round(time.time() - start_total, 2)
    successes = sum(1 for r in results if r["Status"] == "SUCCESS")
    print("\n" + "=" * 70)
    print(f"[BENCHMARK CONCLUÍDO] {successes}/{len(results)} resolvidas com sucesso em {total_time}s.")
    print("=" * 70)

    # Exportação formal em CSV para anexar ou usar de base para tabelas do relatório
    csv_filename = "benchmark_sabiox_results.csv"
    with open(csv_filename, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f, fieldnames=["RF_ID", "Subdomain", "Question", "Status", "Results", "ExecutionTime_s"]
        )
        writer.writeheader()
        writer.writerows(results)

    print(f"[CSV EXPORT] Resultados salvos em '{csv_filename}'.")


if __name__ == "__main__":
    run_benchmark()
