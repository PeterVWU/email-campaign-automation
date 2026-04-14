import { describe, it, expect } from 'vitest'
import { Media } from '../../collections/Media'

describe('Media Collection', () => {
  it('has correct slug', () => {
    expect(Media.slug).toBe('media')
  })

  it('has upload enabled', () => {
    expect(Media.upload).toBe(true)
  })

  it('has public read access', () => {
    expect(typeof Media.access?.read).toBe('function')
    expect(Media.access!.read!({}  as any)).toBe(true)
  })

  it('has alt text field', () => {
    const alt = Media.fields.find((f: any) => f.name === 'alt') as any
    expect(alt).toBeDefined()
    expect(alt.type).toBe('text')
  })
})
