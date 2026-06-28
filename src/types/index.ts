export interface NavLink {
  href: string;
  label: string;
  isCta?: boolean;
}

export interface SiteConfig {
  name: string;
  brandHighlight: string;
  brandName: string;
  logoSrc: string;
  tagline: string;
  description: string;
  contact: {
    phone: string;
    phoneHref: string;
    email: string;
    whatsapp: string;
    whatsappMessage: string;
    coverage: string;
  };
  copyright: string;
}

export interface Stat {
  value: string;
  label: string;
}

export interface Service {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface Feature {
  title: string;
  description: string;
}

export interface Step {
  number: number;
  title: string;
  description: string;
}

export interface Testimonial {
  id: string;
  text: string;
  author: string;
  role: string;
}

export interface ContactFormData {
  nombre: string;
  telefono: string;
  email?: string;
  obraSocial: string;
  institucion: string;
  institucionOtra?: string;
  mensaje?: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}

/** Contrato futuro del backend — consultas de contacto */
export interface ContactSubmission extends ContactFormData {
  id?: string;
  createdAt?: string;
}

/** Contrato futuro — servicios desde base de datos */
export interface ServiceEntity extends Service {
  active: boolean;
  sortOrder: number;
}

export interface InstitutionOption {
  value: string;
  label: string;
}
