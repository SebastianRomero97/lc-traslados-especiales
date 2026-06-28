'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { aboutCarouselImages } from '@/data/about.data';

const SLIDE_INTERVAL_MS = 4500;
const TRANSITION_MS = 900;

export function AboutCarousel() {
  const slides = [...aboutCarouselImages, aboutCarouselImages[0]];
  const [activeIndex, setActiveIndex] = useState(0);
  const [enableTransition, setEnableTransition] = useState(true);

  const advanceSlide = useCallback(() => {
    setActiveIndex((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(advanceSlide, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [advanceSlide]);

  useEffect(() => {
    if (activeIndex !== slides.length - 1) return;

    const resetTimer = window.setTimeout(() => {
      setEnableTransition(false);
      setActiveIndex(0);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => setEnableTransition(true));
      });
    }, TRANSITION_MS);

    return () => window.clearTimeout(resetTimer);
  }, [activeIndex, slides.length]);

  return (
    <div className="about-carousel">
      <div
        className="about-carousel__track"
        style={{
          transform: `translateX(-${activeIndex * 100}%)`,
          transition: enableTransition ? `transform ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)` : 'none',
        }}
      >
        {slides.map((image, index) => (
          <div className="about-carousel__slide" key={`${image.src}-${index}`}>
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes="(max-width: 1140px) 100vw, 1140px"
              className="about-carousel__image"
              priority={index === 0}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
