'use client';

import { useCallback, useEffect, useState } from 'react';

type Publicacion = {
  id: string;
  titulo: string;
  cuerpo: string;
  imagenUrl?: string | null;
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
      {items.map((item) => {
        const titulo = item.titulo?.trim() ?? '';
        const mensaje = item.cuerpo?.trim() ?? '';
        const hasTitulo = Boolean(titulo);
        const hasMensaje = Boolean(mensaje);
        const hasImagen = Boolean(item.imagenUrl);

        return (
          <article key={item.id} className="publicaciones-banner__item">
            {hasTitulo ? <h3 className="publicaciones-banner__titulo">{titulo}</h3> : null}
            {hasMensaje ? <p className="publicaciones-banner__mensaje">{mensaje}</p> : null}
            {hasImagen ? (
              <div className="publicaciones-banner__media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imagenUrl!} alt={hasTitulo ? titulo : 'Publicación'} />
              </div>
            ) : null}
            <time className="publicaciones-banner__vigencia" dateTime={item.endsAt}>
              Vigente hasta {new Date(item.endsAt).toLocaleString('es-AR')}
            </time>
          </article>
        );
      })}
    </section>
  );
}
