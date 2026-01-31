import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk'

export interface ClaudeStreamCallbacks {
  onMessage: (data: Record<string, unknown>) => Promise<void>
}

export async function runClaude(
  prompt: string,
  callbacks: ClaudeStreamCallbacks,
  options?: { sessionId?: string; cwd?: string },
) {
  const claudeQuery = query({
    prompt,
    options: {
      permissionMode: 'bypassPermissions',
      cwd: options?.cwd || process.cwd(),
      ...(options?.sessionId ? { resume: options.sessionId } : {}),
    },
  })

  let claudeSessionId: string | undefined
  let fullContent = ''
  const toolCalls: Array<{ name: string; input: Record<string, unknown>; output?: unknown }> = []
  let currentTool: { name: string; input: Record<string, unknown> } | null = null

  for await (const message of claudeQuery) {
    switch (message.type) {
      case 'system':
        if (message.subtype === 'init') {
          claudeSessionId = message.session_id
          await callbacks.onMessage({
            type: 'system',
            sessionId: message.session_id,
          })
        }
        break

      case 'assistant':
        if (message.message?.content) {
          for (const block of message.message.content) {
            if (block.type === 'text') {
              fullContent += block.text
              await callbacks.onMessage({
                type: 'text',
                content: block.text,
              })
            } else if (block.type === 'tool_use') {
              currentTool = { name: block.name, input: block.input as Record<string, unknown> }
              await callbacks.onMessage({
                type: 'tool_call',
                tool: block.name,
                input: block.input,
              })
            }
          }
        }
        break

      case 'user':
        if (message.message?.content) {
          for (const block of message.message.content) {
            if (block.type === 'tool_result' && currentTool) {
              const completedTool = {
                ...currentTool,
                output: block.content,
              }
              toolCalls.push(completedTool)
              currentTool = null
              await callbacks.onMessage({
                type: 'tool_result',
                tool: completedTool.name,
                output: typeof block.content === 'string'
                  ? block.content.slice(0, 500)
                  : JSON.stringify(block.content).slice(0, 500),
                isError: block.is_error || false,
              })
            }
          }
        }
        break

      case 'result':
        await callbacks.onMessage({
          type: 'result',
          subtype: message.subtype,
          cost: message.total_cost_usd,
          duration: message.duration_ms,
        })
        break
    }
  }

  return { claudeSessionId, fullContent, toolCalls }
}
