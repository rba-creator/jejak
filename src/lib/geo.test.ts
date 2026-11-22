import { describe, expect, it } from 'vitest'
import { jarakMeter, koordinatValid } from './geo'

describe('geo', () => {
  it('jarakMeter: 0 untuk titik sama', () => {
    expect(jarakMeter({ lat: -0.5, lng: 117.1 }, { lat: -0.5, lng: 117.1 })).toBe(0)
  })

  it('jarakMeter: ~111 km per 1 derajat lintang', () => {
    const d = jarakMeter({ lat: 0, lng: 117 }, { lat: 1, lng: 117 })
    expect(d).toBeGreaterThan(110_000)
    expect(d).toBeLessThan(112_000)
  })

  it('koordinatValid', () => {
    expect(koordinatValid(-0.5, 117.1)).toBe(true)
    expect(koordinatValid(91, 0)).toBe(false)
    expect(koordinatValid(0, 181)).toBe(false)
    expect(koordinatValid(Number.NaN, 0)).toBe(false)
  })
})
