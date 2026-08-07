import { jsPDF } from 'jspdf'
import type { MetricSnapshot } from '@/services/metrics'
import type { TrainedModelMeta } from './ml-forecast'
import type { AnomalyPoint, InactivityRisk, TalentCluster } from './ml-utils'
import type { MlWindowDays } from './ml-settings'

export type WeeklyReportData = {
  windowDays: MlWindowDays
  snapshotCount: number
  liveCount: number
  trainableLogins: number
  models: TrainedModelMeta[]
  anomalies: AnomalyPoint[]
  risks: InactivityRisk[]
  clusters: TalentCluster[]
  generatedAt: string
}

export function buildWeeklyReportData(
  snapshots: MetricSnapshot[],
  models: TrainedModelMeta[],
  anomalies: AnomalyPoint[],
  risks: InactivityRisk[],
  clusters: TalentCluster[],
  windowDays: MlWindowDays,
  trainableLogins: number,
): WeeklyReportData {
  return {
    windowDays,
    snapshotCount: snapshots.length,
    liveCount: snapshots.filter((s) => s.isLive).length,
    trainableLogins,
    models,
    anomalies: anomalies.slice(0, 10),
    risks: risks.slice(0, 10),
    clusters,
    generatedAt: new Date().toISOString(),
  }
}

export function exportWeeklyReportPdf(data: WeeklyReportData): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 48
  let y = margin

  const line = (text: string, size = 11, bold = false) => {
    if (y > 780) {
      doc.addPage()
      y = margin
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.text(text, margin, y)
    y += size + 6
  }

  line('NeuraGest · Informe Data Science', 16, true)
  line(`Generado: ${new Date(data.generatedAt).toLocaleString('es-MX')}`, 10)
  line(`Ventana: ${data.windowDays} días`, 10)
  y += 8

  line('Resumen de datos', 13, true)
  line(`Snapshots: ${data.snapshotCount.toLocaleString('es-MX')} · Live: ${data.liveCount.toLocaleString('es-MX')}`)
  line(`Talentos entrenables: ${data.trainableLogins}`)
  line(`Modelos activos: ${data.models.length}`)
  if (data.models.length > 0) {
    const avgR2 = data.models.reduce((s, m) => s + m.r2, 0) / data.models.length
    const avgMae = data.models.reduce((s, m) => s + m.mae, 0) / data.models.length
    line(`Calidad promedio del pronóstico: ${avgR2.toFixed(3)} · precisión promedio: ${avgMae.toFixed(1)}`)
  }
  y += 8

  line('Top anomalías', 13, true)
  if (data.anomalies.length === 0) {
    line('Sin anomalías significativas en el periodo.')
  } else {
    for (const a of data.anomalies.slice(0, 5)) {
      line(`· ${a.displayName}: ${a.viewers} viewers (z=${a.zScore}, ${a.direction})`, 10)
    }
  }
  y += 8

  line('Riesgo de inactividad', 13, true)
  for (const r of data.risks.slice(0, 5)) {
    line(`· ${r.displayName}: ${r.riskLevel} (${r.riskScore}/100)`, 10)
  }
  y += 8

  line('Clusters', 13, true)
  for (const c of data.clusters) {
    line(`· ${c.label}: ${c.logins.length} talentos · avg ${c.centroid.avgViewers} viewers`, 10)
  }

  doc.save(`neuragest-ml-semanal-${data.windowDays}d-${new Date().toISOString().slice(0, 10)}.pdf`)
}
