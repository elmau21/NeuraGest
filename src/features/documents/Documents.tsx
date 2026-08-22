import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileText, FolderOpen } from '@/components/icons'
import { DocumentDrive, documentDriveFileCount } from '@/features/documents/DocumentDrive'
import { WikiPage } from '@/features/wiki/WikiPage'
import { canAccessContratos } from '@/services/permissions'
import { useAuthStore } from '@/stores/auth-store'

export function Documents() {
  const [searchParams, setSearchParams] = useSearchParams()
  const pageParam = searchParams.get('page')
  const tabParam = searchParams.get('tab')
  const [tab, setTab] = useState<'drive' | 'wiki'>(() => (
    tabParam === 'wiki' || pageParam ? 'wiki' : 'drive'
  ))
  const roles = useAuthStore((s) => s.roles)
  const session = useAuthStore((s) => s.session)
  const canSeeContracts = canAccessContratos(roles, session?.login)
  const fileCount = documentDriveFileCount(canSeeContracts)

  useEffect(() => {
    if (tabParam === 'wiki' || pageParam) setTab('wiki')
  }, [tabParam, pageParam])

  const clearDeepLink = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('doc')
    next.delete('folder')
    next.delete('category')
    setSearchParams(next, { replace: true })
  }

  return <>
    <div className="page-title">
      <div>
        <h1>Documentos</h1>
        <p>Archivos por carpeta, contratos, wiki y conocimiento compartido.</p>
      </div>
    </div>
    <div className="document-tabs" role="tablist" aria-label="Secciones de documentos">
      <button className={tab === 'drive' ? 'active' : ''} onClick={() => setTab('drive')}>
        <FolderOpen size={15} />Archivos <span>{fileCount}</span>
      </button>
      <button className={tab === 'wiki' ? 'active' : ''} onClick={() => setTab('wiki')}>
        <FileText size={15} />Wiki y guías
      </button>
    </div>
    {tab === 'wiki' ? (
      <WikiPage pageId={pageParam} onPageHandled={clearDeepLink} />
    ) : (
      <DocumentDrive
        deepDoc={searchParams.get('doc')}
        deepFolder={searchParams.get('folder')}
        deepCategory={searchParams.get('category')}
        onDeepLinkHandled={clearDeepLink}
      />
    )}
  </>
}
