import { redirect } from "next/navigation";

/** Rota antiga → /retornos (Debora 18/11). */
export default function RetornoCredenciadaRedirect() {
  redirect("/retornos");
}
