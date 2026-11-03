// Senhas e tokens assinados usando somente o módulo crypto do Node.js.
// O formato da senha é scrypt$<sal>$<hash>. Requer Node >= 18.
const crypto = require('crypto')
const { promisify } = require('util')
const scrypt = promisify(crypto.scrypt)

const HASH_PREFIX = 'scrypt$'
const TEMPO_SESSAO = 8 * 60 * 60
const TEMPO_CADASTRO = 15 * 60
const CHAVE_DESENVOLVIMENTO = crypto.randomBytes(48).toString('hex')

function segredoToken() {
  const chave = process.env.AUTH_SECRET || (process.env.NODE_ENV === 'production' ? '' : CHAVE_DESENVOLVIMENTO)
  if (chave.length < 32) {
    throw new Error('AUTH_SECRET deve ter pelo menos 32 caracteres para produção.')
  }
  return chave
}

async function hashSenha(senha) {
  if (typeof senha !== 'string' || senha.length < 8 || senha.length > 128) {
    throw new Error('A senha precisa ter entre 8 e 128 caracteres.')
  }
  const sal = crypto.randomBytes(16).toString('hex')
  const hash = await scrypt(senha, sal, 64)
  return `${HASH_PREFIX}${sal}$${hash.toString('hex')}`
}

async function conferirSenha(senha, armazenada) {
  if (typeof senha !== 'string' || !String(armazenada || '').startsWith(HASH_PREFIX)) return false
  const partes = armazenada.split('$')
  if (partes.length !== 3 || !/^[a-f0-9]{32}$/.test(partes[1]) || !/^[a-f0-9]{128}$/.test(partes[2])) return false
  const esperado = Buffer.from(partes[2], 'hex')
  const recebido = await scrypt(senha, partes[1], esperado.length)
  return crypto.timingSafeEqual(esperado, recebido)
}

const base64url = (valor) => Buffer.from(JSON.stringify(valor)).toString('base64url')

function emitirToken(usuario, finalidade = 'sessao') {
  const agora = Math.floor(Date.now() / 1000)
  const payload = {
    sub: String(usuario.id_usuario),
    role: usuario.tipo_usuario,
    scope: finalidade,
    iat: agora,
    exp: agora + (finalidade === 'cadastro' ? TEMPO_CADASTRO : TEMPO_SESSAO),
    iss: 'avicolapinhal-api'
  }
  const conteudo = `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(payload)}`
  const assinatura = crypto.createHmac('sha256', segredoToken()).update(conteudo).digest('base64url')
  return `${conteudo}.${assinatura}`
}

function verificarToken(token) {
  if (typeof token !== 'string' || token.length > 4096) return null
  const partes = token.split('.')
  if (partes.length !== 3) return null
  try {
    const assinatura = crypto.createHmac('sha256', segredoToken()).update(`${partes[0]}.${partes[1]}`).digest()
    const fornecida = Buffer.from(partes[2], 'base64url')
    if (assinatura.length !== fornecida.length || !crypto.timingSafeEqual(assinatura, fornecida)) return null
    const header = JSON.parse(Buffer.from(partes[0], 'base64url').toString('utf8'))
    const payload = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'))
    const agora = Math.floor(Date.now() / 1000)
    if (header.alg !== 'HS256' || payload.iss !== 'avicolapinhal-api' || !Number.isInteger(payload.exp) || payload.exp <= agora || (payload.scope !== 'sessao' && payload.scope !== 'cadastro')) return null
    if (!/^\d+$/.test(payload.sub) || !['ADMINISTRADOR','FUNCIONARIO','PRODUTOR'].includes(payload.role)) return null
    return payload
  } catch { return null }
}

function usuarioPublico(usuario) {
  if (!usuario) return usuario
  const { senha, ...dados } = usuario
  return dados
}

module.exports = { hashSenha, conferirSenha, emitirToken, verificarToken, usuarioPublico, segredoToken }
