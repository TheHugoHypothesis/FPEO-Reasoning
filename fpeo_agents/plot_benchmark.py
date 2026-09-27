import json
import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path

REPORT_PATH = Path("benchmark_evaluation_report.json")
IMG_DIR = Path("images2")
IMG_DIR.mkdir(exist_ok=True)

def main():
    if not REPORT_PATH.exists():
        print(f"[ERRO] {REPORT_PATH} não encontrado.")
        return

    with open(REPORT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    meta = data.get("benchmark_metadata", {})
    global_metrics = data.get("global_performance_metrics", {})
    sub_breakdown = data.get("subdomain_performance_breakdown", {})
    evaluations = data.get("detailed_query_evaluations", [])

    plt.rcParams.update({
        "font.family": "sans-serif",
        "font.size": 10,
        "axes.titlesize": 11,
        "axes.titleweight": "bold",
        "axes.labelsize": 10,
        "xtick.labelsize": 9,
        "ytick.labelsize": 9,
        "grid.alpha": 0.3,
        "grid.linestyle": "--"
    })

    # =========================================================================
    # FIGURA 1: ACURÁCIA E DOMÍNIO (1x2)
    # =========================================================================
    fig1, axs1 = plt.subplots(1, 2, figsize=(12, 4.2), constrained_layout=True)

    # (a) Pass@1 vs EM Final
    pass1_val = global_metrics.get("pass_at_1_accuracy", 0.6377) * 100
    em_val = global_metrics.get("exact_match_accuracy", 0.9275) * 100
    gain = em_val - pass1_val

    bars = axs1[0].bar(
        ["Zero-Shot (Pass@1)", "Após Auto-Correção\n(EM Final)"],
        [pass1_val, em_val],
        color=["#4575b4", "#2ca02c"],
        width=0.45, edgecolor="black", linewidth=0.8
    )
    axs1[0].set_ylim(0, 115)
    axs1[0].set_ylabel("Acurácia (%)")
    axs1[0].set_title("(a) Ganho Epistêmico do Ciclo Agente-Crítico")
    axs1[0].grid(axis="y")

    for bar in bars:
        h = bar.get_height()
        axs1[0].annotate(f"{h:.2f}%", xy=(bar.get_x() + bar.get_width()/2, h),
                         xytext=(0, 4), textcoords="offset points",
                         ha="center", va="bottom", fontweight="bold")

    axs1[0].annotate(
        f"+{gain:.2f}%\nrecuperado pelo Crítico",
        xy=(1, (pass1_val + em_val) / 2),
        xytext=(0.48, (pass1_val + em_val) / 2 + 5),
        ha="center", arrowprops=dict(arrowstyle="->", lw=1.2, color="#d73027"),
        fontsize=9, fontweight="bold", color="#d73027"
    )

    # (b) Por Subdomínio
    sub_names = list(sub_breakdown.keys())
    em_per_sub = [sub_breakdown[s]["exact_match_accuracy"] * 100 for s in sub_names]
    f1_per_sub = [sub_breakdown[s]["macro_f1"] * 100 for s in sub_names]
    counts = [sub_breakdown[s]["total_questions"] for s in sub_names]
    labels_with_count = [f"{s}\n(N={c})" for s, c in zip(sub_names, counts)]

    x = np.arange(len(sub_names))
    width = 0.35
    axs1[1].bar(x - width/2, em_per_sub, width, label="Exact Match", color="#1f78b4", edgecolor="black", lw=0.6)
    axs1[1].bar(x + width/2, f1_per_sub, width, label="Macro F1", color="#33a02c", edgecolor="black", lw=0.6)
    axs1[1].set_ylim(0, 115)
    axs1[1].set_ylabel("Pontuação Média (%)")
    axs1[1].set_title("(b) Desempenho por Subdomínio Ontológico")
    axs1[1].set_xticks(x)
    axs1[1].set_xticklabels(labels_with_count)
    axs1[1].legend(loc="lower right", frameon=True)
    axs1[1].grid(axis="y")

    fig1.savefig(IMG_DIR / "benchmark_accuracy.pdf", bbox_inches="tight")
    fig1.savefig(IMG_DIR / "benchmark_accuracy.png", dpi=300, bbox_inches="tight")
    plt.close(fig1)

    # =========================================================================
    # FIGURA 2: CUSTO E TELEMETRIA (1x2)
    # =========================================================================
    fig2, axs2 = plt.subplots(1, 2, figsize=(12, 4.2), constrained_layout=True)

    tools_used = [q.get("autonomic_telemetry", {}).get("tool_calls_count", 0) for q in evaluations]
    max_tools = max(tools_used) if tools_used else 10
    bins = np.arange(-0.5, max_tools + 1.5, 1)

    # (c) Histograma de Ferramentas
    axs2[0].hist(tools_used, bins=bins, color="#7570b3", edgecolor="black", linewidth=0.8, rwidth=0.8)
    axs2[0].set_xlabel("Chamadas de Ferramentas por Questão")
    axs2[0].set_ylabel("Quantidade de CQs")
    axs2[0].set_title("(c) Custo Cognitivo: Ferramentas por Questão")
    axs2[0].grid(axis="y")

    mean_tools = np.mean(tools_used) if tools_used else 0
    med_tools = np.median(tools_used) if tools_used else 0
    axs2[0].axvline(mean_tools, color="#e7298a", linestyle="--", lw=1.5, label=f"Média ({mean_tools:.1f})")
    axs2[0].axvline(med_tools, color="#1b9e77", linestyle=":", lw=1.5, label=f"Mediana ({med_tools:.0f})")
    axs2[0].legend(frameon=True)

    # (d) Latência vs Ferramentas
    latencies = [q.get("autonomic_telemetry", {}).get("latency_seconds", 0.0) for q in evaluations]
    attempts = [q.get("autonomic_telemetry", {}).get("attempts_needed", 1) for q in evaluations]

    scatter = axs2[1].scatter(latencies, tools_used, c=attempts, cmap="coolwarm", s=55, alpha=0.85, edgecolors="black", linewidth=0.5)
    cbar = plt.colorbar(scatter, ax=axs2[1])
    cbar.set_label("Tentativas até Convergência", rotation=270, labelpad=15)
    cbar.set_ticks(np.unique(attempts) if attempts else [1])
    axs2[1].set_xlabel("Latência de Execução (s)")
    axs2[1].set_ylabel("Chamadas de Ferramentas")
    axs2[1].set_title("(d) Latência vs. Atividade de Inspeção")
    axs2[1].grid(True)

    fig2.savefig(IMG_DIR / "benchmark_telemetry.pdf", bbox_inches="tight")
    fig2.savefig(IMG_DIR / "benchmark_telemetry.png", dpi=300, bbox_inches="tight")
    plt.close(fig2)

    print("[OK] Figuras separadas geradas em images2/:")
    print("  • benchmark_accuracy.pdf")
    print("  • benchmark_telemetry.pdf")

if __name__ == "__main__":
    main()
