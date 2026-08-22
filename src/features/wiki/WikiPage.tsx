import { useCallback, useEffect, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { FileText, Plus } from '@/components/icons'
import {
  blocksToHtml,
  createWikiDocument,
  fetchWikiBlocks,
  fetchWikiDocuments,
  saveWikiContent,
  type WikiDocument,
} from '@/services/wiki'
import { useAuthStore } from '@/stores/auth-store'
import { canMutateWiki } from '@/services/permissions'

export function WikiPage({
  pageId = null,
  onPageHandled,
}: {
  pageId?: string | null
  onPageHandled?: () => void
} = {}) {
  const [documents, setDocuments] = useState<WikiDocument[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const roles = useAuthStore((s) => s.roles)
  const session = useAuthStore((s) => s.session)
  const readonly = !canMutateWiki(roles, session?.login)

  const selected = documents.find((doc) => doc.id === selectedId) ?? documents[0]

  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: 'Escribe bloques de conocimiento…' })],
    content: '<p></p>',
    editable: !readonly,
    onUpdate: ({ editor: ed }) => {
      if (readonly || !selected) return
      window.clearTimeout((window as unknown as { __wikiTimer?: number }).__wikiTimer)
      ;(window as unknown as { __wikiTimer?: number }).__wikiTimer = window.setTimeout(() => {
        setSaveState('saving')
        void saveWikiContent(selected.id, ed.getHTML(), ed.getText())
          .then((ok) => setSaveState(ok ? 'saved' : 'idle'))
          .finally(() => window.setTimeout(() => setSaveState('idle'), 1200))
      }, 700)
    },
  })

  const loadDocs = useCallback(async () => {
    setLoading(true)
    const docs = await fetchWikiDocuments()
    setDocuments(docs)
    if (!selectedId && docs[0]) setSelectedId(docs[0].id)
    setLoading(false)
  }, [selectedId])

  useEffect(() => { void loadDocs() }, [loadDocs])

  useEffect(() => {
    if (!pageId || documents.length === 0) return
    const match = documents.find((doc) => doc.id === pageId)
    if (match) {
      setSelectedId(match.id)
      onPageHandled?.()
    }
  }, [pageId, documents, onPageHandled])

  useEffect(() => {
    if (!editor || !selected) return
    void fetchWikiBlocks(selected.id).then((blocks) => {
      editor.commands.setContent(blocksToHtml(blocks))
      editor.setEditable(!readonly)
    })
  }, [editor, selected, readonly])

  const createPage = async () => {
    if (readonly) return
    const created = await createWikiDocument(`Página ${documents.length + 1}`)
    if (created) {
      setDocuments((current) => [...current, created])
      setSelectedId(created.id)
    }
  }

  return (
    <div className="docs-layout">
      <div className="card docs-tree">
        <b>Espacio NeuraLive</b>
        {loading && <p className="empty-state">Cargando wiki…</p>}
        {documents.map((doc) => (
          <button key={doc.id} className={doc.id === selected?.id ? 'selected' : ''} onClick={() => setSelectedId(doc.id)}>
            <FileText size={15}/>{doc.icon ? `${doc.icon} ` : ''}{doc.title}
          </button>
        ))}
        {readonly && <p className="integration-note">Wiki en solo lectura para staff.</p>}
      </div>
      <div className="card editor">
        <div className="editor-toolbar">
          <button disabled={readonly} onClick={() => editor?.chain().focus().toggleBold().run()}><b>B</b></button>
          <button disabled={readonly} onClick={() => editor?.chain().focus().toggleItalic().run()}><i>I</i></button>
          <button disabled={readonly} onClick={() => editor?.chain().focus().toggleBulletList().run()}>• Lista</button>
          <button disabled={readonly} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
          <span>{saveState === 'saving' ? 'Guardando…' : saveState === 'saved' ? 'Guardado en la nube' : selected?.updatedAt ? `Actualizado ${new Date(selected.updatedAt).toLocaleString('es-MX')}` : 'Wiki'}</span>
          {!readonly && (
            <button className="secondary wiki-new-btn" onClick={() => void createPage()}><Plus size={14}/>Página</button>
          )}
        </div>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
