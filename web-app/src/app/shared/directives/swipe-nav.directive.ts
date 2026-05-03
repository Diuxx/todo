import { Directive, ElementRef, EventEmitter, HostListener, Output, Renderer2 } from '@angular/core';

/**
 * Directive de swipe horizontal pour naviguer entre périodes.
 *
 * Usage :
 *   <div appSwipeNav (swipePrevious)="..." (swipeNext)="...">
 *
 * - Suit le doigt en temps réel pendant le drag.
 * - Sur swipe ≥ 50px : joue l'animation exit/enter et émet l'événement.
 * - prefers-reduced-motion : skip l'animation, émet directement.
 */
@Directive({
  standalone: true,
  selector: '[appSwipeNav]',
})
export class SwipeNavDirective {
  @Output() swipePrevious = new EventEmitter<void>();
  @Output() swipeNext = new EventEmitter<void>();

  private touchStartX = 0;
  private readonly THRESHOLD = 50;
  private readonly CLAMP = 80;
  private readonly EXIT_MS = 180;
  private readonly ENTER_MS = 200;
  private busy = false;

  private get prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  constructor(private readonly el: ElementRef<HTMLElement>, private readonly renderer: Renderer2) {}

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    if (this.busy) return;
    this.touchStartX = event.changedTouches[0].clientX;
  }

  @HostListener('touchmove', ['$event'])
  onTouchMove(event: TouchEvent): void {
    if (this.busy || this.prefersReducedMotion) return;
    const delta = event.changedTouches[0].clientX - this.touchStartX;
    const clamped = Math.max(-this.CLAMP, Math.min(this.CLAMP, delta));
    this.renderer.setStyle(this.el.nativeElement, 'transform', `translateX(${clamped}px)`);
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(event: TouchEvent): void {
    if (this.busy) return;
    const delta = event.changedTouches[0].clientX - this.touchStartX;

    // Reset live-drag transform in all cases
    this.renderer.removeStyle(this.el.nativeElement, 'transform');

    if (Math.abs(delta) < this.THRESHOLD) return;

    const isNext = delta < 0;

    if (this.prefersReducedMotion) {
      isNext ? this.swipeNext.emit() : this.swipePrevious.emit();
      return;
    }

    this.busy = true;
    const exitClass = isNext ? 'swipe-exit-left' : 'swipe-exit-right';
    const enterClass = isNext ? 'swipe-enter-right' : 'swipe-enter-left';

    this.renderer.addClass(this.el.nativeElement, exitClass);

    setTimeout(() => {
      this.renderer.removeClass(this.el.nativeElement, exitClass);
      isNext ? this.swipeNext.emit() : this.swipePrevious.emit();
      this.renderer.addClass(this.el.nativeElement, enterClass);

      setTimeout(() => {
        this.renderer.removeClass(this.el.nativeElement, enterClass);
        this.busy = false;
      }, this.ENTER_MS);
    }, this.EXIT_MS);
  }
}
