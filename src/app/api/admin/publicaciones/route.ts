import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-auth';
import { describeCaughtError } from '@/lib/api-errors';
import { destroyCloudinaryImage, uploadPublicacionImage } from '@/lib/cloudinary';
import { validatePublicacionContent } from '@/lib/publicacion-content';
import type { Role } from '@/lib/roles';

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
  createdBy: { select: { id: true, username: true } },
} as const;

function parseRoles(input: unknown): Role[] | null {
  if (!Array.isArray(input)) return null;
  const roles = [...new Set(input.map(String))].filter((r): r is Role =>
    DESTINATARIOS.includes(r as Role),
  );
  return roles.length > 0 ? roles : null;
}

function parseRolesFromForm(raw: FormDataEntryValue | null): Role[] | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    return parseRoles(JSON.parse(raw) as unknown);
  } catch {
    return parseRoles(raw.split(',').map((s) => s.trim()).filter(Boolean));
  }
}

export async function GET() {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const items = await prisma.publicacion.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: SELECT,
  });

  return NextResponse.json({ data: items });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  let uploadedPublicId: string | null = null;

  try {
    const contentType = request.headers.get('content-type') ?? '';
    let titulo = '';
    let cuerpo = '';
    let roles: Role[] | null = null;
    let startsAt = new Date();
    let endsAt: Date | null = null;
    let active = true;
    let imagenUrl: string | null = null;
    let imagenPublicId: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      titulo = String(form.get('titulo') ?? '').trim();
      cuerpo = String(form.get('cuerpo') ?? '').trim();
      roles = parseRolesFromForm(form.get('roles'));
      const startsRaw = form.get('startsAt');
      const endsRaw = form.get('endsAt');
      startsAt = startsRaw ? new Date(String(startsRaw)) : new Date();
      endsAt = endsRaw ? new Date(String(endsRaw)) : null;
      const activeRaw = form.get('active');
      if (typeof activeRaw === 'string') active = activeRaw !== 'false';

      const file = form.get('imagen');
      if (file instanceof File && file.size > 0) {
        const uploaded = await uploadPublicacionImage(file);
        imagenUrl = uploaded.url;
        imagenPublicId = uploaded.publicId;
        uploadedPublicId = uploaded.publicId;
      }
    } else {
      const body = (await request.json()) as {
        titulo?: string;
        cuerpo?: string;
        roles?: unknown;
        startsAt?: string;
        endsAt?: string;
        active?: boolean;
      };

      titulo = body.titulo?.trim() ?? '';
      cuerpo = body.cuerpo?.trim() ?? '';
      roles = parseRoles(body.roles);
      startsAt = body.startsAt ? new Date(body.startsAt) : new Date();
      endsAt = body.endsAt ? new Date(body.endsAt) : null;
      active = body.active !== false;
      // Imagen solo vía multipart (Cloudinary server-side).
    }

    const failValidation = async (message: string, status = 400) => {
      if (uploadedPublicId) {
        await destroyCloudinaryImage(uploadedPublicId);
        uploadedPublicId = null;
      }
      return NextResponse.json({ message }, { status });
    };

    const content = validatePublicacionContent({
      titulo,
      cuerpo,
      hasImagen: Boolean(imagenUrl),
    });
    if (!content.ok) {
      return failValidation(content.message);
    }
    titulo = content.titulo;
    cuerpo = content.cuerpo;

    if (!roles) {
      return failValidation(
        'Seleccioná al menos un destinatario (Administración, celadoras o choferes).',
      );
    }

    if (!endsAt || Number.isNaN(endsAt.getTime())) {
      return failValidation('Indicá hasta cuándo es válida la publicación.');
    }
    if (Number.isNaN(startsAt.getTime()) || endsAt <= startsAt) {
      return failValidation('La fecha de fin debe ser posterior al inicio.');
    }

    const item = await prisma.publicacion.create({
      data: {
        titulo,
        cuerpo,
        imagenUrl,
        imagenPublicId,
        roles,
        startsAt,
        endsAt,
        active,
        createdById: auth.user.id,
      },
      select: SELECT,
    });

    uploadedPublicId = null;

    return NextResponse.json(
      { data: item, message: 'Publicación creada.' },
      { status: 201 },
    );
  } catch (error) {
    if (uploadedPublicId) {
      await destroyCloudinaryImage(uploadedPublicId);
    }
    console.error('[API /admin/publicaciones POST]', error);
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
      { message: describeCaughtError(error, 'No pudimos crear la publicación.') },
      { status: 500 },
    );
  }
}
