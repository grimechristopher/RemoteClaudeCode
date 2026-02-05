type ToolCategory = 'filesystem' | 'calendar' | 'web' | 'command' | 'search' | 'other'

const TOOL_CATEGORIES: Record<string, ToolCategory> = {
  Read: 'filesystem',
  Write: 'filesystem',
  Edit: 'filesystem',
  Glob: 'filesystem',
  Grep: 'search',
  Bash: 'command',
  WebFetch: 'web',
  WebSearch: 'search',
  NotebookEdit: 'filesystem',
}

export function categorize(toolName: string): ToolCategory {
  return TOOL_CATEGORIES[toolName] || 'other'
}

export function summarize(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'Read':
      return `Reading ${input.file_path || 'file'}`
    case 'Write':
      return `Writing ${input.file_path || 'file'}`
    case 'Edit':
      return `Editing ${input.file_path || 'file'}`
    case 'Glob':
      return `Finding files: ${input.pattern || ''}`
    case 'Grep':
      return `Searching for "${input.pattern || ''}"${input.path ? ` in ${input.path}` : ''}`
    case 'Bash': {
      const cmd = String(input.command || '')
      return `Running: ${cmd.length > 60 ? cmd.slice(0, 57) + '...' : cmd}`
    }
    case 'WebFetch':
      return `Fetching ${input.url || 'URL'}`
    case 'WebSearch':
      return `Searching: "${input.query || ''}"`
    case 'NotebookEdit':
      return `Editing notebook ${input.notebook_path || ''}`
    default:
      return `${toolName}`
  }
}
