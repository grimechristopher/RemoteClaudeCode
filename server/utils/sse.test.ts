import { describe, it, expect, vi } from 'vitest'
import { createSSEStream } from './sse'

describe('createSSEStream', () => {
  it('sets correct headers', () => {
    const res = {
      setHeader: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    } as any

    createSSEStream(res)

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream')
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache')
    expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive')
  })

  it('pushes data in SSE format', () => {
    const res = {
      setHeader: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    } as any

    const stream = createSSEStream(res)
    stream.push('{"type":"test"}')

    expect(res.write).toHaveBeenCalledWith('data: {"type":"test"}\n\n')
  })
})
