'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { aboutCarouselImages } from '@/data/about.data';

const SLIDE_INTERVAL_MS = 5000;

export function AboutCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const slideCount = aboutCarouselImages.length;

  const goToSlide = useCallback((index: number) => {
    setActiveIndex((index + slideCount) % slideCount);
  }, [slideCount]);

  const goNext = useCallback(() => {
    goToSlide(activeIndex + 1);
  }, [activeIndex, goToSlide]);

  const goPrev = useCallback(() => {
    goToSlide(activeIndex - 1);
  }, [activeIndex, goToSlide]);

  useEffect(() => {
    if (isPaused) return;

    const timer = window.setInterval(goNext, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [activeIndex, goNext, isPaused]);

  return (
    <div
      className="about-carousel"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div className="about-carousel__glow" aria-hidden="true" />

      <div className="about-carousel__viewport">
        <div className="about-carousel__slides" aria-live="polite">
          {aboutCarouselImages.map((image, index) => (
            <div
              className={`about-carousel__slide${index === activeIndex ? ' is-active' : ''}`}
              key={image.src}
              aria-hidden={index !== activeIndex}
            >
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

        <div className="about-carousel__gradient" aria-hidden="true" />

        <div className="about-carousel__counter" aria-hidden="true">
          <span className="about-carousel__counter-current">
            {String(activeIndex + 1).padStart(2, '0')}
          </span>
          <span className="about-carousel__counter-sep">/</span>
          <span className="about-carousel__counter-total">
            {String(slideCount).padStart(2, '0')}
          </span>
        </div>

        <div className="about-carousel__controls">
          <button
            type="button"
            className="about-carousel__nav"
            onClick={goPrev}
            aria-label="Imagen anterior"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="about-carousel__nav"
            onClick={goNext}
            aria-label="Imagen siguiente"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="about-carousel__progress" aria-hidden="true">
          <div
            key={`${activeIndex}-${isPaused}`}
            className={`about-carousel__progress-fill${isPaused ? ' is-paused' : ''}`}
            style={{ animationDuration: `${SLIDE_INTERVAL_MS}ms` }}
          />
        </div>
      </div>

      <div className="about-carousel__thumbs" role="tablist" aria-label="Galería de fotos">
        {aboutCarouselImages.map((image, index) => (
          <button
            type="button"
            key={image.src}
            role="tab"
            aria-selected={index === activeIndex}
            aria-label={`Ver imagen ${index + 1}: ${image.alt}`}
            className={`about-carousel__thumb${index === activeIndex ? ' is-active' : ''}`}
            onClick={() => goToSlide(index)}
          >
            <Image
              src={image.src}
              alt=""
              fill
              sizes="80px"
              className="about-carousel__thumb-image"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
