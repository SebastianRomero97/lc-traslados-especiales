import { useEffect, useState } from 'react';
import { getServices, getTestimonials } from '@/services/contact.service';
import { services as fallbackServices, testimonials as fallbackTestimonials } from '@/data/landing.data';
import type { Service, Testimonial } from '@/types';

interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

export function useServices(): AsyncState<Service[]> {
  const [state, setState] = useState<AsyncState<Service[]>>({
    data: fallbackServices,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    getServices()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Error al cargar servicios';
          setState((prev) => ({ ...prev, loading: false, error: message }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function useTestimonials(): AsyncState<Testimonial[]> {
  const [state, setState] = useState<AsyncState<Testimonial[]>>({
    data: fallbackTestimonials,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    getTestimonials()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Error al cargar testimonios';
          setState((prev) => ({ ...prev, loading: false, error: message }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
