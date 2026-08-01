import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-auth';
import { describeCaughtError } from '@/lib/api-errors';
import { destroyCloudinaryImage, uploadPublicacionImage } from '@/lib/cloudinary';
import { validatePublicacionContent } from '@/lib/publicacion-content';
import type { Role } from '@/lib/roles';

type Params = { params: Promise<{ id: string }> };

const DESTINATARIOS: Role[] = ['ADMINISTRACION', 'CELADORA', 'CHOFER'];

const SELECT = {
  id: true,
  titulo: true,
  cuerpo: true,
  imagenUrl: true,
  imagenPublicId: true,
  roles: true,
  startsAt: true,
  endsAt: true,
  active: true,
  createdAt: true,
} as const;

function parseRoles(input: unknown): Role[] | null {
  if (!Array.isArray(input)) return null;
  const roles = [...new Set(input.map(String))].filter((r): r is Role =>
    DESTINATARIOS.includes(r as Role),
  );
  return roles.length > 0 ? roles : null;
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;
  let newUploadedPublicId: string | null = null;

  try {
    const existing = await prisma.publicacion.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Publicación no encontrada.' }, { status: 404 });
    }

    const contentType = request.headers.get('content-type') ?? '';
    const data: {
      titulo?: string;
      cuerpo?: string;
      roles?: Role[];
      startsAt?: Date;
      endsAt?: Date;
      active?: boolean;
      imagenUrl?: string | null;
      imagenPublicId?: string | null;
    } = {};

    let removeImage = false;
    let previousPublicId: string | null = existing.imagenPublicId;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const titulo = form.get('titulo');
      const cuerpo = form.get('cuerpo');
      const rolesRaw = form.get('roles');
      const startsAt = form.get('startsAt');
      const endsAt = form.get('endsAt');
      const active = form.get('active');
      const quitarImagen = form.get('quitarImagen');

      if (typeof titulo === 'string') {
        data.titulo = titulo.trim();
      }
      if (typeof cuerpo === 'string') {
        data.cuerpo = cuerpo.trim();
      }
      if (typeof rolesRaw === 'string') {
        try {
          const roles = parseRoles(JSON.parse(rolesRaw) as unknown);
          if (!roles) {
            return NextResponse.json(
              {
                message:
                  'Seleccioná al menos un destinatario (Administración, celadoras o choferes).',
              },
              { status: 400 },
            );
          }
          data.roles = roles;
        } catch {
          return NextResponse.json({ message: 'Roles inválidos.' }, { status: 400 });
        }
      }
      if (typeof startsAt === 'string') data.startsAt = new Date(startsAt);
      if (typeof endsAt === 'string') data.endsAt = new Date(endsAt);
      if (typeof active === 'string') data.active = active !== 'false';
      if (quitarImagen === 'true' || quitarImagen === '1') removeImage = true;

      const file = form.get('imagen');
      if (file instanceof File && file.size > 0) {
        const uploaded = await uploadPublicacionImage(file);
        data.imagenUrl = uploaded.url;
        data.imagenPublicId = uploaded.publicId;
        newUploadedPublicId = uploaded.publicId;
      } else if (removeImage) {
        data.imagenUrl = null;
        data.imagenPublicId = null;
      }
    } else {
      const body = (await request.json()) as {
        titulo?: string;
        cuerpo?: string;
        roles?: unknown;
        startsAt?: string;
        endsAt?: string;
        active?: boolean;
        quitarImagen?: boolean;
      };

      if (typeof body.titulo === 'string') {
        data.titulo = body.titulo.trim();
      }
      if (typeof body.cuerpo === 'string') {
        data.cuerpo = body.cuerpo.trim();
      }
      if (body.roles !== undefined) {
        const roles = parseRoles(body.roles);
        if (!roles) {
          return NextResponse.json(
            {
              message:
                'Seleccioná al menos un destinatario (Administración, celadoras o choferes).',
            },
            { status: 400 },
          );
        }
        data.roles = roles;
      }
      if (typeof body.startsAt === 'string') {
        data.startsAt = new Date(body.startsAt);
      }
      if (typeof body.endsAt === 'string') {
        data.endsAt = new Date(body.endsAt);
      }
      if (typeof body.active === 'boolean') data.active = body.active;
      if (body.quitarImagen === true) {
        data.imagenUrl = null;
        data.imagenPublicId = null;
        removeImage = true;
      }
    }

    const startsAt = data.startsAt ?? existing.startsAt;
    const endsAt = data.endsAt ?? existing.endsAt;
    if (endsAt <= startsAt) {
      if (newUploadedPublicId) {
        await destroyCloudinaryImage(newUploadedPublicId);
        newUploadedPublicId = null;
      }
      return NextResponse.json(
        { message: 'La fecha de fin debe ser posterior al inicio.' },
        { status: 400 },
      );
    }

    const finalTitulo = data.titulo ?? existing.titulo;
    const finalCuerpo = data.cuerpo ?? existing.cuerpo;
    const finalHasImagen =
      data.imagenUrl !== undefined ? Boolean(data.imagenUrl) : Boolean(existing.imagenUrl);

    const content = validatePublicacionContent({
      titulo: finalTitulo,
      cuerpo: finalCuerpo,
      hasImagen: finalHasImagen,
    });
    if (!content.ok) {
      if (newUploadedPublicId) {
        await destroyCloudinaryImage(newUploadedPublicId);
        newUploadedPublicId = null;
      }
      return NextResponse.json({ message: content.message }, { status: 400 });
    }
    if (data.titulo !== undefined) data.titulo = content.titulo;
    if (data.cuerpo !== undefined) data.cuerpo = content.cuerpo;

    const item = await prisma.publicacion.update({
      where: { id },
      data,
      select: SELECT,
    });

    // Si reemplazamos o quitamos imagen, borrar la anterior en Cloudinary
    if ((newUploadedPublicId || removeImage) && previousPublicId && previousPublicId !== newUploadedPublicId) {
      await destroyCloudinaryImage(previousPublicId);
    }

    newUploadedPublicId = null;

    return NextResponse.json({ data: item, message: 'Publicación actualizada.' });
  } catch (error) {
    if (newUploadedPublicId) {
      await destroyCloudinaryImage(newUploadedPublicId);
    }
    console.error('[API /admin/publicaciones PATCH]', error);
    if (error instanceof Error) {
      const msg = error.message;
      if (
        msg.includes('Cloudinary') ||
        msg.includes('Formato no permitido') ||
        msg.includes('5 MB')
      ) {
        return NextResponse.json({ message: msg }, { status: 400 });
      }
    }
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos actualizar la publicación.') },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    const existing = await prisma.publicacion.findUnique({
      where: { id },
      select: { id: true, imagenPublicId: true },
    });
    if (!existing) {
      return NextResponse.json({ message: 'Publicación no encontrada.' }, { status: 404 });
    }

    await prisma.publicacion.delete({ where: { id } });
    await destroyCloudinaryImage(existing.imagenPublicId);

    return NextResponse.json({ message: 'Publicación eliminada.' });
  } catch (error) {
    console.error('[API /admin/publicaciones DELETE]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos eliminar la publicación.') },
      { status: 500 },
    );
  }
}
