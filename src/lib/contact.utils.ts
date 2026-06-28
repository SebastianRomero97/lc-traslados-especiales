export function formatContactMessage(data: {
  nombre: string;
  telefono: string;
  email?: string;
  obraSocial: string;
  institucion: string;
  institucionOtra?: string;
  mensaje?: string;
  institutionOptions: { value: string; label: string }[];
}): string {
  const institucionLabel =
    data.institucion === 'otra'
      ? data.institucionOtra?.trim() || 'No indicó'
      : data.institutionOptions.find((o) => o.value === data.institucion)?.label ??
        data.institucion;

  return [
    `Nombre: ${data.nombre}`,
    `Teléfono: ${data.telefono}`,
    `Email: ${data.email?.trim() || 'No indicó email'}`,
    `Obra social: ${data.obraSocial.trim()}`,
    `Institución: ${institucionLabel}`,
    `Información adicional: ${data.mensaje?.trim() || 'Sin información adicional'}`,
  ].join('\n');
}

export function getWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
