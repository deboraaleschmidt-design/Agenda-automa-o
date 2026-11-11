import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home-hero">
      <div>
        <p className="home-eyebrow">Tenant</p>
        <h1>T.ESTRATÉGICO</h1>
        <p>
          Hub operacional · segmentos da empresa. Acesso por link privado +
          token.
        </p>
        <div className="home-segments">
          <Link className="btn btn-primary" href="/painel">
            Desconexão
          </Link>
          <Link className="btn btn-ghost" href="/iat">
            IAT
          </Link>
          <Link className="btn btn-ghost" href="/financeiro">
            Financeiro
          </Link>
        </div>
      </div>
    </main>
  );
}
