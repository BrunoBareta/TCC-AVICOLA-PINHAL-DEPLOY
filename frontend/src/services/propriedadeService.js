import { api } from 'src/boot/axios'

const listar = async () => {
  const response = await api.get(
    '/propriedades'
  )

  return response.data
}

const buscarPorId = async (
  idPropriedade
) => {
  const response = await api.get(
    `/propriedades/${idPropriedade}`
  )

  return response.data
}

const buscarPorUsuario = async (
  idUsuario
) => {
  const response = await api.get(
    `/propriedades/usuario/${idUsuario}`
  )

  return response.data
}

const criar = async (
  dados,
  cadastroToken = null
) => {
  const config = cadastroToken
    ? { headers: { Authorization: `Bearer ${cadastroToken}` }, cadastroTemporario: true }
    : {}
  const response = await api.post(
    '/propriedades',
    dados,
    config
  )

  return response.data
}

const atualizar = async (
  idPropriedade,
  dados
) => {
  const response = await api.put(
    `/propriedades/${idPropriedade}`,
    dados
  )

  return response.data
}

const desativar = async (
  idPropriedade
) => {
  const response = await api.delete(
    `/propriedades/${idPropriedade}`
  )

  return response.data
}

export default {
  listar,
  buscarPorId,
  buscarPorUsuario,
  criar,
  atualizar,
  desativar
}