import { api } from 'src/boot/axios'

const login = async (email, senha) => {
  const response = await api.post('/login', {
    email,
    senha
  })

  return response.data
}

const logout = () => {
  sessionStorage.removeItem('usuario')
  sessionStorage.removeItem('token')
  sessionStorage.removeItem('cadastro_token')
  // Limpeza da versão anterior, que compartilhava credenciais entre abas.
  localStorage.removeItem('usuario')
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  localStorage.removeItem('authUser')
}

const getUsuarioLogado = () => {
  const usuario = sessionStorage.getItem('usuario')
  // Não restaurar sessões antigas do localStorage: elas podem pertencer a outra aba.
  if (!sessionStorage.getItem('token')) return null

  if (!usuario) {
    return null
  }

  try {
    return JSON.parse(usuario)
  } catch {
    sessionStorage.removeItem('usuario')
    return null
  }
}

const salvarToken = (token) => {
  if (token) sessionStorage.setItem('token', token)
  else sessionStorage.removeItem('token')
}
const salvarUsuario = (usuario) => {
  sessionStorage.setItem('usuario', JSON.stringify(usuario))
}

export default {
  login,
  logout,
  getUsuarioLogado,
  salvarUsuario,
  salvarToken
}