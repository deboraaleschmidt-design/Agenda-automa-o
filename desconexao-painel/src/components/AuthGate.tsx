"use client";

import { useEffect, useState, type ReactNode } from "react";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tokenInput, setTokenInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/session", {
          credentials: "include",
          cache: "no-store",
        });
        if (!cancelled) setAuthed(res.ok);
      } catch {
        if (!cancelled) setAuthed(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveToken = async () => {
    const t = tokenInput.trim();
    if (!t) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      setAuthed(true);
      setTokenInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no login");
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="painel-page">
        <p className="painel-foot" style={{ padding: "2rem" }}>
          Verificando sessão…
        </p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="painel-page">
        <div className="demo-banner" role="status">
          Link privado · informe o token de acesso
        </div>
        <div className="token-gate container" style={{ padding: "2rem 1rem" }}>
          <p>
            Tenant <strong>T.ESTRATÉGICO</strong>. Cole o token do secret{" "}
            <code>PAINEL_API_TOKEN</code>.
          </p>
          {error ? <p className="banner-error">{error}</p> : null}
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Token"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveToken();
            }}
          />
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => void saveToken()}
            disabled={loading}
          >
            Entrar
          </button>
          <p style={{ marginTop: "1rem" }}>
            <a href="/">← Segmentos</a>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
