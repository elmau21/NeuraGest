const localContractUrls = import.meta.glob('../../assets/contratos/**/*.pdf', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

export type LocalContract = {
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

function cleanTitle(fileName: string, sourcePath: string, talent?: LocalContract['talent']) {
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

export const localContracts: LocalContract[] = Object.entries(localContractUrls)
  .map(([modulePath, localUrl]) => {
    const sourcePath = modulePath.replace('../../assets/contratos/', '').replaceAll('\\', '/')
    const fileName = sourcePath.split('/').at(-1) ?? sourcePath
    const normalized = sourcePath.toLowerCase()
    const alias = talentAliases.find(([needle]) => normalized.includes(needle))
    const talent = alias ? { login: alias[1], name: alias[2] } : undefined
    return {
      id: `local:${sourcePath}`,
      fileName,
      localUrl,
      section: sourcePath.split('/')[0] ?? 'General',
      sourcePath,
      talent,
      title: cleanTitle(fileName, sourcePath, talent),
    }
  })
  .sort((a, b) => a.title.localeCompare(b.title, 'es'))

export function storagePathForContract(contract: LocalContract) {
  return contract.sourcePath
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9./_-]+/g, '-')
    .toLowerCase()
}

export async function loadRemoteContractUrls(): Promise<Map<string, { path: string; url?: string }>> {
  const { supabase } = await import('@/services/supabase')
  const client = supabase
  if (!client) return new Map()

  const { data: { session } } = await client.auth.getSession()
  if (!session) return new Map()

  const { data, error } = await client
    .from('documents')
    .select('storage_path, storage_bucket')
    .eq('category', 'Contratos')
    .eq('kind', 'file')
    .is('deleted_at', null)
    .not('storage_path', 'is', null)
  if (error || !data) return new Map()

  const contractIdByPath = new Map(localContracts.map((c) => [storagePathForContract(c), c.id]))
  const remoteContracts = new Map<string, { path: string; url?: string }>()
  await Promise.all(data.flatMap((document) => {
    if (!document.storage_path) return []
    const contractId = contractIdByPath.get(document.storage_path)
    if (!contractId) return []
    const bucket = document.storage_bucket ?? 'contratos'
    remoteContracts.set(contractId, { path: document.storage_path })
    return [client.storage.from(bucket).createSignedUrl(document.storage_path, 60 * 60).then(({ data: signed }) => {
      if (signed?.signedUrl) remoteContracts.set(contractId, { path: document.storage_path!, url: signed.signedUrl })
    })]
  }))
  return remoteContracts
}

export function mergeLocalContracts(remote: Map<string, { path: string; url?: string }>): LocalContract[] {
  return localContracts.map((contract) => {
    const r = remote.get(contract.id)
    return { ...contract, remotePath: r?.path, remoteUrl: r?.url }
  })
}
