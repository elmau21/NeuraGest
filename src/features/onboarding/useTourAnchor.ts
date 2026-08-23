import { useEffect, useState, type CSSProperties } from 'react'

const VIEWPORT_PAD = 14
const CARD_WIDTH = 420
const CARD_EST_HEIGHT = 240
const SPOTLIGHT_PAD = 4

export type TourSpotlight = {
  top: number
  left: number
  width: number
  height: number
}

export type TourAnchorState = {
  spotlight: TourSpotlight | null
  cardStyle: CSSProperties
  centered: boolean
}

const centeredCardStyle = (): CSSProperties => ({
  position: 'fixed',
  bottom: VIEWPORT_PAD,
  left: '50%',
  transform: 'translateX(-50%)',
  width: `min(${CARD_WIDTH}px, calc(100vw - ${VIEWPORT_PAD * 2}px))`,
})

export function useTourAnchor(
  selector: string | undefined,
  active: boolean,
  stepKey: string | number,
): TourAnchorState {
  const [state, setState] = useState<TourAnchorState>({
    spotlight: null,
    cardStyle: centeredCardStyle(),
    centered: true,
  })

  useEffect(() => {
    if (!active) return

    let highlighted: Element | null = null

    const clearHighlight = () => {
      if (highlighted) {
        highlighted.classList.remove('tour-target-active')
        highlighted = null
      }
      document.body.classList.remove('tour-sidebar-active')
    }

    const update = () => {
      clearHighlight()

      if (!selector) {
        setState({
          spotlight: null,
          cardStyle: centeredCardStyle(),
          centered: true,
        })
        return
      }

      const el = document.querySelector(selector)
      if (!el) {
        setState({
          spotlight: null,
          cardStyle: centeredCardStyle(),
          centered: true,
        })
        return
      }

      document.body.classList.add('tour-sidebar-active')
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      highlighted = el
      el.classList.add('tour-target-active')

      const rect = el.getBoundingClientRect()
      const spotlight: TourSpotlight = {
        top: rect.top - SPOTLIGHT_PAD,
        left: rect.left - SPOTLIGHT_PAD,
        width: rect.width + SPOTLIGHT_PAD * 2,
        height: rect.height + SPOTLIGHT_PAD * 2,
      }

      const cardW = Math.min(CARD_WIDTH, window.innerWidth - VIEWPORT_PAD * 2)
      let top = rect.top
      let left = rect.right + 16

      if (left + cardW > window.innerWidth - VIEWPORT_PAD) {
        left = Math.max(VIEWPORT_PAD, Math.min(rect.left, window.innerWidth - cardW - VIEWPORT_PAD))
        top = rect.bottom + 12
      }

      if (top + CARD_EST_HEIGHT > window.innerHeight - VIEWPORT_PAD) {
        top = rect.top - CARD_EST_HEIGHT - 12
      }

      top = Math.max(VIEWPORT_PAD, Math.min(top, window.innerHeight - CARD_EST_HEIGHT - VIEWPORT_PAD))
      left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - cardW - VIEWPORT_PAD))

      setState({
        spotlight,
        cardStyle: {
          position: 'fixed',
          top,
          left,
          width: cardW,
          maxWidth: `calc(100vw - ${VIEWPORT_PAD * 2}px)`,
        },
        centered: false,
      })
    }

    const t1 = window.setTimeout(update, 50)
    const t2 = window.setTimeout(update, 400)

    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)

    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      clearHighlight()
    }
  }, [active, selector, stepKey])

  return state
}
