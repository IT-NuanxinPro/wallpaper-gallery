import gsap from 'gsap'
import { fitTransitionImage } from './detailTransition'

export function playWallpaperTransition({ cover, image, context, target, animator = gsap, onComplete = () => {} }) {
  const previousVisibility = target.element.style.visibility
  let timeline
  let active = true
  function cancel() {
    if (!active)
      return
    active = false
    timeline?.kill()
    target.element.style.visibility = previousVisibility
  }
  animator.set(cover, { ...context.rect, borderRadius: context.radius || 0 })
  animator.set(image, fitTransitionImage(context.rect, context.width, context.height, context.fit))
  target.element.style.visibility = 'hidden'
  try {
    timeline = animator.timeline({
      defaults: { duration: 0.3, ease: 'power2.inOut' },
      onComplete() {
        if (!active)
          return
        cancel()
        onComplete()
      },
    })
    timeline.to(cover, { ...target.rect, borderRadius: target.radius || 0 }, 0)
      .to(image, fitTransitionImage(target.rect, context.width, context.height, target.fit), 0)
  }
  catch {
    cancel()
    onComplete()
  }
  return cancel
}
