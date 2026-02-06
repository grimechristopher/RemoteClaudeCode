import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatApp from './ChatApp.vue'
import * as chatApi from '../api/chat'

vi.mock('../api/chat')

describe('ChatApp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders header with title', () => {
    const wrapper = mount(ChatApp)
    expect(wrapper.text()).toContain('Command Center')
  })

  it('renders message input', () => {
    const wrapper = mount(ChatApp)
    const input = wrapper.find('textarea')
    expect(input.exists()).toBe(true)
  })

  it('renders send button', () => {
    const wrapper = mount(ChatApp)
    const button = wrapper.find('button[type="submit"]')
    expect(button.exists()).toBe(true)
  })

  it('shows empty state when no messages', () => {
    const wrapper = mount(ChatApp)
    expect(wrapper.text()).toContain('Start a conversation')
  })

  it('displays user message after sending', async () => {
    const mockSession = {
      id: 'test-123',
      title: 'Test',
      createdAt: new Date().toISOString(),
    }

    const mockReader = {
      read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
    } as any

    vi.mocked(chatApi.createSession).mockResolvedValue(mockSession)
    vi.mocked(chatApi.sendMessage).mockResolvedValue(mockReader)

    const wrapper = mount(ChatApp)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('Hello!')

    const form = wrapper.find('form')
    await form.trigger('submit')

    // Wait for async updates
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(wrapper.text()).toContain('Hello!')
  })

  it('shows streaming indicator while processing', async () => {
    const mockSession = {
      id: 'session-123',
      title: 'Test',
      createdAt: '2026-02-04',
    }

    let resolveRead: any
    const mockReader = {
      read: vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveRead = resolve
        })
      ),
    } as any

    vi.mocked(chatApi.createSession).mockResolvedValue(mockSession)
    vi.mocked(chatApi.sendMessage).mockResolvedValue(mockReader)

    const wrapper = mount(ChatApp)

    await wrapper.find('textarea').setValue('Test')
    await wrapper.find('button[type="submit"]').trigger('submit')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.streaming-indicator').exists()).toBe(true)

    resolveRead({ done: true, value: undefined })
    await new Promise((resolve) => setTimeout(resolve, 10))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.streaming-indicator').exists()).toBe(false)
  })
})
