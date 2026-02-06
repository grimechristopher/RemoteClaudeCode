import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FeedItem from './FeedItem.vue'

describe('FeedItem', () => {
  it('renders user message', () => {
    const wrapper = mount(FeedItem, {
      props: {
        item: {
          type: 'user',
          content: 'Hello!',
          timestamp: '2026-02-04',
        },
      },
    })

    expect(wrapper.text()).toContain('Hello!')
    expect(wrapper.find('.user-message').exists()).toBe(true)
  })

  it('renders Claude text message', () => {
    const wrapper = mount(FeedItem, {
      props: {
        item: {
          type: 'text',
          content: 'Hi there!',
          timestamp: '2026-02-04',
        },
      },
    })

    expect(wrapper.text()).toContain('Hi there!')
    expect(wrapper.find('.claude-message').exists()).toBe(true)
  })

  it('renders tool call with summary', () => {
    const wrapper = mount(FeedItem, {
      props: {
        item: {
          type: 'tool_call',
          tool: 'Read',
          summary: 'Reading file.txt',
          category: 'filesystem',
          input: { file_path: 'file.txt' },
          timestamp: '2026-02-04',
        },
      },
    })

    expect(wrapper.text()).toContain('Reading file.txt')
    expect(wrapper.find('.tool-call').exists()).toBe(true)
    expect(wrapper.text()).toContain('📁')
  })

  it('renders tool result', () => {
    const wrapper = mount(FeedItem, {
      props: {
        item: {
          type: 'tool_result',
          tool: 'Read',
          output: 'File contents...',
          isError: false,
          timestamp: '2026-02-04',
        },
      },
    })

    expect(wrapper.find('.tool-result').exists()).toBe(true)
    expect(wrapper.text()).toContain('✓')
  })

  it('renders error message', () => {
    const wrapper = mount(FeedItem, {
      props: {
        item: {
          type: 'error',
          content: 'Something went wrong',
          timestamp: '2026-02-04',
        },
      },
    })

    expect(wrapper.text()).toContain('Something went wrong')
    expect(wrapper.find('.error-message').exists()).toBe(true)
  })

  it('renders result meta with cost and duration', () => {
    const wrapper = mount(FeedItem, {
      props: {
        item: {
          type: 'result',
          cost: 0.0045,
          duration: 2300,
          timestamp: '2026-02-04',
        },
      },
    })

    expect(wrapper.text()).toContain('$0.0045')
    expect(wrapper.text()).toContain('2.3s')
  })
})
