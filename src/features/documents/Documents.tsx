import { useState } from 'react'
import { FileText, FolderOpen } from '@/components/icons'
import { DocumentDrive, documentDriveFileCount } from '@/features/documents/DocumentDrive'
import { WikiPage } from '@/features/wiki/WikiPage'
import { canAccessContratos } from '@/services/permissions'
import { useAuthStore } from '@/stores/auth-store'

export function Documents() {
  const [tab, setTab] = useState<'drive' | 'wiki'>('drive')
  const roles = useAuthStore((s) => s.roles)
  const session = useAuthStore((s) => s.session)
  const canSeeContracts = canAccessContratos(roles, session?.login)
  const fileCount = documentDriveFileCount(canSeeContracts)

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
    {tab === 'wiki' ? <WikiPage /> : <DocumentDrive />}
  </>
}
