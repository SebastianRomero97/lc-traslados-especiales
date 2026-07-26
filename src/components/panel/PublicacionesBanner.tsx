'use client';

import { useCallback, useEffect, useState } from 'react';

type Publicacion = {
  id: string;
  titulo: string;
  cuerpo: string;
  roles: string[];
  startsAt: string;
  endsAt: string;
};

export function PublicacionesBanner() {
  const [items, setItems] = useState<Publicacion[]>([]);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/publicaciones/activas');
      if (!response.ok) return;
      const body = await response.json();
      setItems(body.data as Publicacion[]);
    } catch {
      // silencioso: el banner no debe romper el panel
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (items.length === 0) return null;

  return (
    <section className="publicaciones-banner" aria-label="Avisos activos">
      {items.map((item) => (
        <article key={item.id} className="publicaciones-banner__item">
          <h3>{item.titulo}</h3>
          <p>{item.cuerpo}</p>
          <time dateTime={item.endsAt}>
            Vigente hasta {new Date(item.endsAt).toLocaleString('es-AR')}
          </time>
        </article>
      ))}
    </section>
  );
}
