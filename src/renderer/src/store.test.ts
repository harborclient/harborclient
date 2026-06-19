import { describe, expect, it } from 'vitest'
import { substituteVariables } from '#/renderer/src/store'

describe('substituteVariables', () => {
  it('replaces known variable tokens', () => {
    const result = substituteVariables('https://{{host}}/api/{{version}}', [
      { key: 'host', value: 'api.example.com' },
      { key: 'version', value: 'v1' }
    ])

    expect(result).toBe('https://api.example.com/api/v1')
  })

  it('leaves unknown tokens unchanged', () => {
    const result = substituteVariables('https://{{host}}/{{missing}}', [
      { key: 'host', value: 'api.example.com' }
    ])

    expect(result).toBe('https://api.example.com/{{missing}}')
  })

  it('handles surrounding whitespace inside braces', () => {
    const result = substituteVariables('https://{{ host }}/users', [
      { key: 'host', value: 'api.example.com' }
    ])

    expect(result).toBe('https://api.example.com/users')
  })

  it('trims variable keys when building the lookup', () => {
    const result = substituteVariables('https://{{host}}', [
      { key: '  host  ', value: 'api.example.com' }
    ])

    expect(result).toBe('https://api.example.com')
  })

  it('ignores blank-key variables', () => {
    const result = substituteVariables('https://{{host}}', [
      { key: '   ', value: 'ignored.example.com' },
      { key: 'host', value: 'api.example.com' }
    ])

    expect(result).toBe('https://api.example.com')
  })
})
