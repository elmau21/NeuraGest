import { OAUTH_REDIRECT_TO } from '@/services/supabase-twitch-oauth'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'https://YOUR_PROJECT.supabase.co'
const supabaseCallback = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/callback`

export function TwitchOAuthDoc() {
  return (
    <details className="gcal-oauth-doc">
      <summary>Configuración de inicio de sesión Twitch</summary>
      <ol>
        <li>
          <b>Consola de desarrolladores Twitch</b> → URLs de redirección autorizadas:
          <code>{supabaseCallback}</code>
        </li>
        <li>
          <b>Panel NeuraGest</b> → Autenticación → URLs de redirección:
          <code>{OAUTH_REDIRECT_TO}</code>
        </li>
        <li>
          <b>Proveedor Twitch</b>: identificador y clave secreta de Twitch.
        </li>
        <li>Flujo: inicio de sesión en navegador → vuelta a la app de escritorio → sesión activa.</li>
      </ol>
      <p className="integration-note">
        Si el login falla con «redirect_uri mismatch», verifica que ambas URLs estén registradas exactamente
        (sin barra final extra). El retorno a la app solo funciona en NeuraGest de escritorio.
      </p>
    </details>
  )
}
