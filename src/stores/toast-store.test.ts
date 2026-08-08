import { describe, expect, it } from 'vitest'
import { enqueueToast } from './toast-store'

describe('enqueueToast', () => {
  it('ignora mensajes vacíos', () => {
    expect(enqueueToast([], '   ')).toEqual([])
  })

  it('apila toasts y limita a 4', () => {
    let queue = enqueueToast([], 'Uno', 'success')
    queue = enqueueToast(queue, 'Dos', 'error')
    queue = enqueueToast(queue, 'Tres')
    queue = enqueueToast(queue, 'Cuatro')
    queue = enqueueToast(queue, 'Cinco', 'info')
    expect(queue).toHaveLength(4)
    expect(queue.map((t) => t.message)).toEqual(['Dos', 'Tres', 'Cuatro', 'Cinco'])
    expect(queue[0]?.tone).toBe('error')
    expect(queue[3]?.tone).toBe('info')
  })
})
