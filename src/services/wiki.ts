import { supabase } from '@/services/supabase'
import { DEFAULT_ORG_ID } from '@/services/org'

export type WikiDocument = {
  id: string
  title: string
  icon?: string
  updatedAt?: string
}

export type WikiBlock = {
  id: string
  documentId: string
  type: string
  content: Record<string, unknown>
  position: number
}

export async function fetchWikiDocuments(): Promise<WikiDocument[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('documents')
    .select('id,title,icon,updated_at')
    .eq('organization_id', DEFAULT_ORG_ID)
    .eq('category', 'wiki')
    .is('deleted_at', null)
    .order('title')
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    icon: row.icon ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  }))
}

export async function createWikiDocument(title: string): Promise<WikiDocument | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('documents')
    .insert({ organization_id: DEFAULT_ORG_ID, title, category: 'wiki', icon: '📄' })
    .select('id,title,icon,updated_at')
    .single()
  if (error || !data) return null
  await supabase.from('document_blocks').insert({
    organization_id: DEFAULT_ORG_ID,
    document_id: data.id,
    type: 'paragraph',
    content: { text: '' },
    position: 1,
  })
  await supabase.rpc('log_activity', {
    p_entity_type: 'document',
    p_entity_id: data.id,
    p_action: 'wiki_created',
    p_metadata: { title },
  })
  return { id: data.id, title: data.title, icon: data.icon ?? undefined, updatedAt: data.updated_at ?? undefined }
}

export async function fetchWikiBlocks(documentId: string): Promise<WikiBlock[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('document_blocks')
    .select('id,document_id,type,content,position')
    .eq('document_id', documentId)
    .is('deleted_at', null)
    .order('position')
  return (data ?? []).map((row) => ({
    id: row.id,
    documentId: row.document_id,
    type: row.type,
    content: (row.content ?? {}) as Record<string, unknown>,
    position: Number(row.position ?? 0),
  }))
}

export async function saveWikiContent(documentId: string, html: string, plainText: string): Promise<boolean> {
  if (!supabase) return false
  const { data: existing } = await supabase
    .from('document_blocks')
    .select('id')
    .eq('document_id', documentId)
    .is('deleted_at', null)
    .limit(1)
  const payload = { type: 'richtext', content: { html, text: plainText } }
  if (existing && existing.length > 0) {
    const { error } = await supabase.from('document_blocks').update(payload).eq('id', existing[0].id)
    if (error) return false
  } else {
    const { error } = await supabase.from('document_blocks').insert({
      organization_id: DEFAULT_ORG_ID,
      document_id: documentId,
      ...payload,
      position: 1,
    })
    if (error) return false
  }
  await supabase.from('documents').update({ updated_at: new Date().toISOString() }).eq('id', documentId)
  return true
}

export function blocksToHtml(blocks: WikiBlock[]): string {
  const block = blocks.find((b) => b.type === 'richtext')
  if (block?.content.html) return String(block.content.html)
  const paragraph = blocks.find((b) => b.type === 'paragraph')
  if (paragraph?.content.text) return `<p>${String(paragraph.content.text)}</p>`
  return '<p></p>'
}
