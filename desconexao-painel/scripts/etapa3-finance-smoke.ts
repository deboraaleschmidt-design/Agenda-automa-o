/**
 * Etapa 3: sync Financeiro live (só leitura) e imprime totais TOTAL + Nov.
 * Run: npx --yes tsx scripts/etapa3-finance-smoke.ts
 */
import { syncFinanceiro } from "../src/lib/finance-sync";

function money(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function run(mes: string, segmento: string) {
  const p = await syncFinanceiro({ mes, segmento });
  console.log("\n===", segmento, mes, "===");
  console.log("fonte", p.fonte, p.status, p.mensagem);
  console.log("servicos", p.subtotais[segmento === "todos" ? "geral" : (segmento as "desconexao" | "iat")].servicos);
  const sub =
    segmento === "desconexao"
      ? p.subtotais.desconexao
      : segmento === "iat"
        ? p.subtotais.iat
        : p.subtotais.geral;
  console.log("valor_faturar", money(sub.valor_faturar), "sem_preco", sub.sem_preco);
  console.log("a_pagar_des", money(p.total_a_pagar));
  console.log("top5", p.atividades.slice(0, 5).map((a) => ({
    seg: a.segmento,
    cod: a.codigo,
    qtd: a.quantidade,
    vu: a.preco_unitario,
    tot: a.valor,
    sem: a.sem_preco,
  })));
  console.log("duvidas", p.duvidas.slice(0, 6));
  console.log("fat_ago+", p.faturamento_ago_mais);
  console.log("meses", p.meses_disponiveis);
  return p;
}

async function main() {
  for (const mes of ["TOTAL", "2026-11"] as const) {
    for (const seg of ["desconexao", "iat", "todos"] as const) {
      await run(mes, seg);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
