import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReveal } from '../../hooks/useReveal';

describe('useReveal', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('cascades elements that arrive together and leaves the rest hidden', () => {
    document.body.innerHTML = `<div class="landing-page">${'<div class="reveal"></div>'.repeat(8)}</div>`;
    const elements = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));

    let notify: (entries: Array<{ target: Element; isIntersecting: boolean }>) => void = () => {};
    const unobserve = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: typeof notify) {
          notify = callback;
        }
        observe() {}
        unobserve = unobserve;
        disconnect() {}
      }
    );

    renderHook(() => useReveal());
    notify(elements.map((target, index) => ({ target, isIntersecting: index !== 1 })));

    const arrived = elements.filter((_, index) => index !== 1);
    expect(arrived.map((element) => element.style.getPropertyValue('--reveal-delay'))).toEqual([
      '0ms',
      '70ms',
      '140ms',
      '210ms',
      '280ms',
      '350ms',
      '350ms',
    ]);
    expect(arrived.every((element) => element.classList.contains('is-visible'))).toBe(true);
    expect(unobserve).toHaveBeenCalledTimes(7);

    expect(elements[1].classList.contains('is-visible')).toBe(false);
    expect(elements[1].style.getPropertyValue('--reveal-delay')).toBe('');
    // The delay must not leak into every transition on the element (hover colours stay immediate).
    expect(arrived.every((element) => element.style.transitionDelay === '')).toBe(true);
  });
});
