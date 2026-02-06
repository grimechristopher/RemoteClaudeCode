import { Response } from 'express'

export interface SSEStream {
  push: (data: string) => void
  close: () => void
}

export function createSSEStream(res: Response): SSEStream {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  return {
    push: (data: string) => {
      res.write(`data: ${data}\n\n`)
    },
    close: () => {
      res.end()
    },
  }
}
