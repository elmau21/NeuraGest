import { useMemo, useState } from 'react'
import { Archive, Download } from '@/components/icons'
import { useAppStore } from '@/stores/app-store'
import { downloadBoardPack } from '@/services/board-pack'
import { isTauri } from '@/services/twitch'

function monthStart(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

export function BoardPackPage() {
  const talents = useAppStore((s) => s.talents)
  const [month, setMonth] = useState(monthStart())
  const [selected, setSelected] = useState<Set<string>>(() => new Set(talents.slice(0, 3).map((t) => t.login)))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedList = useMemo(() => [...selected], [selected])

  const toggle = (login: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(login)) next.delete(login)
      else next.add(login)
      return next
    })
  }

  const exportPack = async () => {
    if (selectedList.length === 0) return
    setLoading(true)
    setError(null)
    try {
      await downloadBoardPack({ talents, talentLogins: selectedList, month })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  if (!isTauri) {
    return <div className="card agency-gate"><p>Board pack ZIP requiere la app de escritorio NeuraGest.</p></div>
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1><Archive size={22} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />Board pack</h1>
          <p>Exporta ZIP con media kits PDF, briefs de campaña y forecast mensual de comisiones.</p>
        </div>
        <button className="primary" disabled={loading || selectedList.length === 0} onClick={() => void exportPack()}>
          <Download size={16} />{loading ? 'Generando ZIP…' : 'Descargar board pack'}
        </button>
      </div>

      {error && <p className="integration-note">{error}</p>}

      <div className="ops-two-col">
        <div className="card">
          <h3>Mes de referencia</h3>
          <label className="ops-field">
            Periodo
            <input type="month" value={month.slice(0, 7)} onChange={(e) => setMonth(`${e.target.value}-01`)} />
          </label>
          <p className="integration-note">Incluye ledger del mes seleccionado y forecast del mes siguiente.</p>
        </div>
        <div className="card">
          <h3>Contenido del ZIP</h3>
          <ul className="board-pack-contents">
            <li><b>media-kits/</b> — PDF por talento seleccionado</li>
            <li><b>briefs/</b> — briefs de campaña activos en la nube</li>
            <li><b>forecast/</b> — CSV ledger + proyección + resumen estructurado</li>
          </ul>
        </div>
      </div>

      <div className="card">
        <h3>Talentos incluidos en media kits</h3>
        <div className="board-pack-talents">
          {talents.map((t) => (
            <label key={t.login} className="board-pack-talent">
              <input type="checkbox" checked={selected.has(t.login)} onChange={() => toggle(t.login)} />
              {t.avatar ? <img src={t.avatar} alt="" /> : <div className="avatar-placeholder">{t.displayName.slice(0, 2)}</div>}
              <span>{t.displayName}</span>
            </label>
          ))}
        </div>
      </div>
    </>
  )
}
