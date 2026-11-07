import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home-hero">
      <div>
        <h1>DESCONEXÃO</h1>
        <p>
          Painel ao vivo · tenant <strong>T.ESTRATÉGICO</strong>. Acesso por
          link privado + token.
        </p>
        <Link className="btn btn-primary" href="/painel">
          Abrir painel
        </Link>
      </div>
    </main>
  );
}
