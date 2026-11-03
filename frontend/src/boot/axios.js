import axios from 'axios'
// Na Render use VITE_API_URL=https://seu-backend.onrender.com (sem barra final).
// Em desenvolvimento, mantemos a API local/IP da rede, sem alterar as páginas.
const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
const urlConfigurada = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')
if (typeof window !== 'undefined' && window.location.protocol === 'https:' && !urlConfigurada) {
  throw new Error('Configure VITE_API_URL com o endereço HTTPS do backend antes de publicar o frontend.')
}
const api = axios.create({
  baseURL: urlConfigurada || `http://${host}:3000`,
  timeout: 30000
})
api.interceptors.request.use((config) => {
  // Requisições de cadastro podem passar um token temporário explícito.
  // Nunca o substituímos pelo token da sessão do administrador/técnico.
  const tokenExplicito = config.headers?.get?.('Authorization') || config.headers?.Authorization
  if (!tokenExplicito) {
    // Cada aba mantém seu próprio usuário e token, sem trocar identidade com outras abas.
    const token = sessionStorage.getItem('token') || sessionStorage.getItem('cadastro_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
api.interceptors.response.use(
  (resposta) => resposta,
  (erro) => {
    const url = String(erro.config?.url || '')
    const isLogin = url === '/login'
    // Um token temporário expirado não deve derrubar outra sessão autenticada.
    if (erro.response?.status === 401 && !isLogin && !erro.config?.cadastroTemporario) {
      sessionStorage.removeItem('usuario')
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('cadastro_token')
      // O redirecionamento ocorrerá somente nas rotas protegidas.
      if (typeof window !== 'undefined' && window.location.hash !== '#/' && !url.startsWith('/senha')) window.location.hash = '#/'
    }
    return Promise.reject(erro)
  }
)
export default ({ app }) => { app.config.globalProperties.$api = api }
export { api }
