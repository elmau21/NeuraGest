import { navTourIds } from '@/services/nav-config'

export function tourSelectorForRoute(route?: string): string | undefined {
  if (!route) return undefined
  const path = route.split('?')[0]
  const tourId = navTourIds[path]
  if (tourId) return `[data-tour="${tourId}"]`
  if (path === '/control' || path.startsWith('/control/')) return 'a.nav-control-center'
  return `nav a[href="${path}"]`
}
