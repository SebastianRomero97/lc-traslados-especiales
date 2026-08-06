import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { describeCaughtError } from '@/lib/api-errors';
import { requireOperativoApi } from '@/lib/operativo-auth';

/** Preferencias de navegación (Maps / Waze) del chofer. */
export async function GET() {
  const auth = await requireOperativoApi(['CHOFER']);
  if ('error' in auth) return auth.error;

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { navGoogleMaps: true, navWaze: true },
    });
    return NextResponse.json({
      data: {
        navGoogleMaps: user?.navGoogleMaps !== false,
        navWaze: user?.navWaze !== false,
      },
    });
  } catch (error) {
    console.error('[API /operativo/preferencias-nav GET]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos cargar la preferencia.') },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireOperativoApi(['CHOFER']);
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as {
      navGoogleMaps?: boolean;
      navWaze?: boolean;
    };

    if (typeof body.navGoogleMaps !== 'boolean' || typeof body.navWaze !== 'boolean') {
      return NextResponse.json(
        { message: 'Indicá Google Maps y Waze (true/false).' },
        { status: 400 },
      );
    }

    if (!body.navGoogleMaps && !body.navWaze) {
      return NextResponse.json(
        { message: 'Tenés que dejar marcada al menos una app de navegación.' },
        { status: 400 },
      );
    }

    const user = await prisma.user.update({
      where: { id: auth.user.id },
      data: {
        navGoogleMaps: body.navGoogleMaps,
        navWaze: body.navWaze,
      },
      select: { navGoogleMaps: true, navWaze: true },
    });

    return NextResponse.json({
      data: user,
      message: 'Preferencia de navegación guardada.',
    });
  } catch (error) {
    console.error('[API /operativo/preferencias-nav PATCH]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos guardar la preferencia.') },
      { status: 500 },
    );
  }
}
