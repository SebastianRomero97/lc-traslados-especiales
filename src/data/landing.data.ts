import type { Feature, InstitutionOption, Service, Stat, Step, Testimonial } from '@/types';

export const heroStats: Stat[] = [
  { value: '+80', label: 'Familias confían en nosotros' },
  { value: '+5', label: 'Años de experiencia' },
  { value: '100%', label: 'Traslados monitoreados' },
];

export const services: Service[] = [
  {
    id: 'personalizado',
    icon: '🧩',
    title: 'Atención personalizada',
    description:
      'Conocemos las necesidades de cada uno para brindar un traslado seguro, tranquilo y adaptado a su ritmo.',
  },
  {
    id: 'contencion',
    icon: '♿',
    title: 'Traslados con contención',
    description:
      'Cada viaje está pensado para que el niño se sienta acompañado, contenido y seguro de principio a fin.',
  },
  {
    id: 'destinos',
    icon: '🏥',
    title: 'A donde él necesita ir',
    description:
      'Lo llevamos a su centro de terapia, rehabilitación o tratamiento, respetando sus horarios y su bienestar.',
  },
  {
    id: 'rutas',
    icon: '💛',
    title: 'Rutas a medida',
    description:
      'Diseñamos cada recorrido según las necesidades del niño, su destino y la rutina de la familia.',
  },
];

export const features: Feature[] = [
  {
    title: 'Conductores profesionales',
    description:
      'Personal apto y capacitado para el traslado adecuado y seguro de los niños.',
  },
  {
    title: 'Atención personalizada',
    description:
      'Conocemos las necesidades de cada niño para brindar un traslado seguro, tranquilo y adaptado.',
  },
  {
    title: 'Celadoras capacitadas',
    description:
      'Nuestro personal cuenta con capacitaciones constantes para estar preparados y brindar la mejor atención a cada niño.',
  },
  {
    title: 'Seguimiento GPS',
    description:
      'La empresa cuenta con monitoreo de cada vehículo en tiempo real para la seguridad de sus hijos y el control del recorrido.',
  },
  {
    title: 'Comunicación directa',
    description:
      'El personal a cargo de su hijo se pondrá en contacto para mantenerlo informado y coordinar horarios de traslado.',
  },
];

export const steps: Step[] = [
  {
    number: 1,
    title: 'Contactanos',
    description:
      'Contanos sobre tu hijo, su obra social, la institución a la que asiste y los horarios de sus terapias o tratamientos.',
  },
  {
    number: 2,
    title: 'Entrevista',
    description:
      'Coordinamos una entrevista para que puedan conocernos y evacuar posibles dudas.',
  },
  {
    number: 3,
    title: 'Armamos la ruta',
    description:
      'Evaluamos distancias, necesidades específicas y horarios para diseñar el traslado ideal.',
  },
  {
    number: 4,
    title: '¡A trasladar!',
    description:
      'Tu hijo comienza sus traslados con nosotros. Seguimiento y comunicación incluidos desde el primer día.',
  },
];

export const testimonials: Testimonial[] = [
  {
    id: '1',
    text: 'Llevan a mi hijo al centro de terapia todos los días con mucha paciencia y cuidado. Se nota que entienden sus necesidades y eso nos da una paz enorme.',
    author: 'María G.',
    role: 'Mamá de Lucía, 8 años',
  },
  {
    id: '2',
    text: 'El seguimiento por GPS y la comunicación constante son un alivio. Sé cuándo sale de rehabilitación y cuándo está por llegar a casa.',
    author: 'Carlos R.',
    role: 'Papá de Tomás',
  },
  {
    id: '3',
    text: 'Profesionales y humanos. Los conductores tratan a mi hijo con respeto y cariño, y siempre están atentos ante cualquier consulta nuestra.',
    author: 'Ana L.',
    role: 'Mamá de Mateo, 6 años',
  },
];

/** Instituciones frecuentes — personalizá esta lista con las reales */
export const institutionOptions: InstitutionOption[] = [
  { value: 'centro-terapia-integral', label: 'Centro de terapia integral' },
  { value: 'centro-rehabilitacion', label: 'Centro de rehabilitación' },
  { value: 'instituto-desarrollo', label: 'Instituto de desarrollo infantil' },
  { value: 'centro-estimulacion', label: 'Centro de estimulación temprana' },
  { value: 'otra', label: 'Otra institución (escribir nombre)' },
];
