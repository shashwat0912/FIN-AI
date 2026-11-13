import { useEffect } from 'react';

export function useReveal() {
  useEffect(() => {
    const elements = document.querySelectorAll('.landing-page .reveal');

    if (!('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries
          .filter((entry) => entry.isIntersecting)
          .forEach((entry, index) => {
            // Elements that arrive together cascade in instead of appearing as one block.
            (entry.target as HTMLElement).style.setProperty('--reveal-delay', `${Math.min(index, 5) * 70}ms`);
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
}
