const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// A short side-to-side nudge that dies out quickly, so a rejected field says "this one" without shouting.
export function shake(element: Element | null) {
  if (!element || prefersReducedMotion()) return;
  element.animate?.(
    [0, -6, 5, -3, 2, 0].map((x) => ({ transform: `translateX(${x}px)` })),
    { duration: 360, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  );
}

// Cancelling the browser's validation tooltip also cancels its focus move; this finds the field it would have focused.
export const isFirstInvalid = (control: HTMLInputElement) =>
  Array.from(control.form?.elements ?? []).find((element) => !(element as HTMLInputElement).validity.valid) === control;
