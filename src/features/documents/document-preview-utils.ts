export type DocumentPreviewMode = 'loading' | 'pdf' | 'html'

export function buildPdfPreviewSrc(url: string): string {
  const base = url.split('#')[0] ?? url
  return `${base}#toolbar=0&navpanes=0`
}

export function extractHtmlBody(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const body = doc.body
    if (body?.childElementCount) return body.innerHTML
  } catch {
    /* use raw html */
  }
  return html
}

function looksLikeHtmlDocument(text: string, contentType: string): boolean {
  const ct = contentType.toLowerCase()
  if (ct.includes('text/html')) return true
  if (ct.includes('application/pdf') || ct.includes('application/octet-stream')) return false
  const sample = text.slice(0, 4096).toLowerCase()
  return /<html[\s>]|<body[\s>]|<table[\s>]/i.test(sample)
}

export async function probeDocumentPreview(
  url: string,
  fileName: string,
): Promise<{ mode: Exclude<DocumentPreviewMode, 'loading'>; html?: string }> {
  const likelyPdf = /\.pdf$/i.test(fileName) || /\.pdf(?:$|[?#])/i.test(url)

  try {
    const head = await fetch(url, { method: 'HEAD' })
    const contentType = head.headers.get('content-type') ?? ''
    if (contentType.toLowerCase().includes('application/pdf') || (likelyPdf && !contentType.includes('text/html'))) {
      return { mode: 'pdf' }
    }
    if (!contentType.toLowerCase().includes('text/html') && likelyPdf) {
      return { mode: 'pdf' }
    }
  } catch {
    if (likelyPdf) return { mode: 'pdf' }
  }

  try {
    const res = await fetch(url)
    const contentType = res.headers.get('content-type') ?? ''
    const text = await res.text()
    if (looksLikeHtmlDocument(text, contentType)) {
      return { mode: 'html', html: extractHtmlBody(text) }
    }
  } catch {
    /* fallback below */
  }

  return { mode: 'pdf' }
}
