import { useEffect, useMemo, useState } from 'react'
import { Cloud, Download, ExternalLink, FileText, FolderLock, HardDrive, Search, UserRound } from 'lucide-react'
import { WikiPage } from '@/features/wiki/WikiPage'
import { supabase } from '@/services/supabase'
import { logContractActivity } from '@/services/audit'

const localContractUrls = import.meta.glob('../../assets/contratos/**/*.pdf', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

type Contract = {
  id: string
  fileName: string
  localUrl: string
  remotePath?: string
  remoteUrl?: string
  section: string
  sourcePath: string
  talent?: { login: string; name: string }
  title: string
}

const talentAliases = [
  ['arikyu_', 'arikyu_', 'Arikyu'],
  ['nosomevt', 'nosomevt', 'Nosome'],
  ['kumitacui', 'kumitacui', 'Kumitacui'],
  ['ryonikku', 'ryonikku', 'Ryonikku'],
  ['suimi', 'suimivt', 'Suimi'],
  ['tesitoazul', 'tesitoazul', 'TesitoAzul'],
  ['ashitakaseiren', 'ashitakaseiren', 'AshitakaSeiren'],
  ['bhikoru', 'bhikoruvt', 'Bhikoru'],
  ['cold', 'cold__vt', 'Cold'],
  ['shisuvr', 'shisuvr', 'SHISUvr'],
] as const

function cleanTitle(fileName: string, sourcePath: string, talent?: Contract['talent']) {
  if (talent) {
    const generation = sourcePath.toLowerCase().includes('/gen 2/') ? ' (Gen 2)' : ''
    return `Contrato de representación — ${talent.name}${generation}`
  }
  return fileName
    .replace(/\.pdf$/i, '')
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const localContracts: Contract[] = Object.entries(localContractUrls)
  .map(([modulePath, localUrl]) => {
    const sourcePath = modulePath.replace('../../assets/contratos/', '').replaceAll('\\', '/')
    const fileName = sourcePath.split('/').at(-1) ?? sourcePath
    const normalized = sourcePath.toLowerCase()
    const alias = talentAliases.find(([needle]) => normalized.includes(needle))
    const talent = alias ? { login: alias[1], name: alias[2] } : undefined
    return {
      id: sourcePath,
      fileName,
      localUrl,
      section: sourcePath.split('/')[0] ?? 'General',
      sourcePath,
      talent,
      title: cleanTitle(fileName, sourcePath, talent),
    }
  })
  .sort((a, b) => a.title.localeCompare(b.title, 'es'))

const CONTRACTS_BUCKET = 'contratos'

function storagePath(contract: Contract) {
  return contract.sourcePath
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9./_-]+/g, '-')
    .toLowerCase()
}

type RemoteContract = {
  path: string
  url?: string
}

async function loadRemoteContracts() {
  const client = supabase
  if (!client) return new Map<string, RemoteContract>()
  const { data: { session } } = await client.auth.getSession()
  if (!session) return new Map<string, RemoteContract>()

  const { data, error } = await client
    .from('documents')
    .select('storage_path')
    .eq('category', 'Contratos')
    .eq('storage_bucket', CONTRACTS_BUCKET)
    .is('deleted_at', null)
  if (error || !data) return new Map<string, RemoteContract>()

  const contractIdByPath = new Map(localContracts.map((contract) => [storagePath(contract), contract.id]))
  const remoteContracts = new Map<string, RemoteContract>()
  await Promise.all(data.flatMap((document) => {
    if (!document.storage_path) return []
    const contractId = contractIdByPath.get(document.storage_path)
    if (!contractId) return []
    remoteContracts.set(contractId, { path: document.storage_path })
    return [client.storage.from(CONTRACTS_BUCKET).createSignedUrl(document.storage_path, 60 * 60).then(({ data: signed }) => {
      if (signed?.signedUrl) remoteContracts.set(contractId, { path: document.storage_path!, url: signed.signedUrl })
    })]
  }))
  return remoteContracts
}

export function Documents() {
  const [tab, setTab] = useState<'contracts' | 'wiki'>('contracts')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(localContracts[0]?.id ?? '')
  const [remoteContracts, setRemoteContracts] = useState(new Map<string, RemoteContract>())
  const [remoteLoading, setRemoteLoading] = useState(true)

  useEffect(() => {
    setRemoteLoading(true)
    void loadRemoteContracts()
      .then(setRemoteContracts)
      .catch(() => undefined)
      .finally(() => setRemoteLoading(false))
  }, [])

  const contracts = useMemo(() => localContracts.map((contract) => {
    const remote = remoteContracts.get(contract.id)
    return {
      ...contract,
      remotePath: remote?.path,
      remoteUrl: remote?.url,
    }
  }), [remoteContracts])
  const filtered = contracts.filter((contract) =>
    `${contract.title} ${contract.fileName} ${contract.talent?.login ?? ''}`.toLowerCase().includes(query.toLowerCase()),
  )
  const selected = contracts.find((contract) => contract.id === selectedId) ?? contracts[0]

  useEffect(() => {
    if (tab !== 'contracts' || !selected) return
    void logContractActivity('viewed', selected.fileName, selected.talent?.login)
  }, [selected?.id, tab])

  return <>
    <div className="page-title"><div><h1>Documentos</h1><p>Contratos, wiki, procesos y conocimiento compartido.</p></div></div>
    <div className="document-tabs" role="tablist" aria-label="Secciones de documentos">
      <button className={tab === 'contracts' ? 'active' : ''} onClick={() => setTab('contracts')}><FolderLock size={15}/>Contratos <span>{contracts.length}</span></button>
      <button className={tab === 'wiki' ? 'active' : ''} onClick={() => setTab('wiki')}><FileText size={15}/>Wiki y guías</button>
    </div>
    {tab === 'wiki' ? <WikiPage/> : <div className="contracts-layout">
      <div className="card contracts-panel">
        <label className="contract-search"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar contrato o talento…"/></label>
        <div className="contracts-count">{filtered.length} PDF{filtered.length === 1 ? '' : 's'} · {remoteLoading ? '…' : remoteContracts.size} en la nube · {remoteLoading ? '…' : contracts.length - remoteContracts.size} solo local</div>
        <div className="contracts-list">
          {filtered.map((contract) => <button className={contract.id === selected?.id ? 'selected' : ''} key={contract.id} onClick={() => setSelectedId(contract.id)}>
            <span className="pdf-icon">PDF</span>
            <span><b>{contract.title}</b><small>{contract.talent ? <><UserRound size={11}/>@{contract.talent.login}</> : contract.section}<span className={contract.remotePath ? 'storage-status remote' : 'storage-status local'}>{contract.remotePath ? <Cloud size={10}/> : <HardDrive size={10}/>} {contract.remotePath ? 'en la nube' : 'solo local'}</span></small></span>
          </button>)}
          {filtered.length === 0 && <p className="empty-state">No hay contratos que coincidan con la búsqueda.</p>}
        </div>
      </div>
      <div className="card contract-viewer">
        {selected ? <>
          <div className="contract-viewer-head"><div><b>{selected.title}</b><span>{selected.fileName} · Contrato / PDF · {selected.remotePath ? 'en la nube' : 'solo local'}</span></div><a href={selected.remoteUrl ?? selected.localUrl} target="_blank" rel="noreferrer"><ExternalLink size={15}/>Abrir</a><a href={selected.remoteUrl ?? selected.localUrl} download={selected.fileName} onClick={() => void logContractActivity('downloaded', selected.fileName, selected.talent?.login)}><Download size={15}/>Descargar</a></div>
          <iframe src={selected.remoteUrl ?? selected.localUrl} title={`Vista previa de ${selected.title}`}/>
        </> : <div className="contract-empty"><FileText size={40}/><p>No hay contratos disponibles.</p></div>}
      </div>
    </div>}
  </>
}
