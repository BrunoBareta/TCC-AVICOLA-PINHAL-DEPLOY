const db = require('../database/db')
const { verificarToken } = require('./credenciais')

const acessoNegado = (res) => res.status(403).json({ message: 'Você não tem permissão para esta operação.' })
const idValido = (valor) => /^\d+$/.test(String(valor ?? '')) && Number(valor) > 0
const idUsuario = (req) => Number(req.usuario?.id_usuario)
const admin = (req) => req.usuario?.tipo_usuario === 'ADMINISTRADOR'
const tecnico = (req) => req.usuario?.tipo_usuario === 'FUNCIONARIO'
const produtor = (req) => req.usuario?.tipo_usuario === 'PRODUTOR'

async function autenticar(req, res, next) {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '')
  const claims = match && verificarToken(match[1])
  if (!claims) return res.status(401).json({ message: 'Sessão ausente ou expirada. Entre novamente.' })
  try {
    const result = await db.query(
      `SELECT id_usuario, nome, email, tipo_usuario, ativo FROM usuarios WHERE id_usuario = $1`,
      [Number(claims.sub)]
    )
    const usuario = result.rows[0]
    if (!usuario || !usuario.ativo || usuario.tipo_usuario !== claims.role) {
      return res.status(401).json({ message: 'Sessão inválida. Entre novamente.' })
    }
    req.usuario = usuario
    req.escopo = claims.scope
    next()
  } catch (error) {
    console.error('Erro ao verificar sessão:', error)
    return res.status(503).json({ message: 'Não foi possível validar a sessão.' })
  }
}

async function dadosChamado(id, usuario) {
  if (!idValido(id)) return null
  const result = await db.query(
    `SELECT c.id_chamado, c.id_usuario, c.status,
       EXISTS (SELECT 1 FROM chamado_funcionario cf
         WHERE cf.id_chamado = c.id_chamado AND cf.id_funcionario = $2
         AND cf.status_aceite = 'ACEITO') AS atribuido
     FROM chamados c WHERE c.id_chamado = $1`,
    [Number(id), Number(usuario.id_usuario)]
  )
  return result.rows[0] || null
}
function podeLerChamado(chamado, req) {
  return !!chamado && (admin(req) ||
    (produtor(req) && Number(chamado.id_usuario) === idUsuario(req)) ||
    (tecnico(req) && (chamado.atribuido || chamado.status === 'PENDENTE')))
}
function podeTrabalharChamado(chamado, req) {
  return !!chamado && (admin(req) || (tecnico(req) && chamado.atribuido))
}
async function verificaChamado(req, res, next, id, tipo = 'leitura') {
  const chamado = await dadosChamado(id, req.usuario)
  const permitido = tipo === 'leitura' ? podeLerChamado(chamado, req) :
    tipo === 'trabalho' ? podeTrabalharChamado(chamado, req) :
    tipo === 'anexo' ? (podeTrabalharChamado(chamado, req) || (produtor(req) && Number(chamado?.id_usuario) === idUsuario(req))) :
    tipo === 'pendente-proprietario' ? (admin(req) || (produtor(req) && Number(chamado?.id_usuario) === idUsuario(req) && chamado?.status === 'PENDENTE')) : false
  return permitido ? next() : acessoNegado(res)
}
async function idChamadoRelacionado(tabela, coluna, id) {
  if (!idValido(id)) return null
  const permitido = {
    historico_chamado: 'id_historico',
    materiais_utilizados: 'id_material',
    deslocamentos: 'id_deslocamento',
    anexos_chamado: 'id_anexo'
  }
  if (permitido[tabela] !== coluna) throw new Error('Recurso inválido')
  const result = await db.query(`SELECT id_chamado FROM ${tabela} WHERE ${coluna} = $1`, [Number(id)])
  return result.rows[0]?.id_chamado ?? null
}
async function donoPropriedade(id, req) {
  if (!idValido(id)) return false
  const r = await db.query('SELECT id_usuario FROM propriedades WHERE id_propriedade = $1', [Number(id)])
  return Number(r.rows[0]?.id_usuario) === idUsuario(req)
}
async function donoUnidade(id, req) {
  if (!idValido(id)) return false
  const r = await db.query(`SELECT p.id_usuario FROM unidades_propriedade up
    JOIN propriedades p ON p.id_propriedade = up.id_propriedade WHERE up.id_unidade = $1`, [Number(id)])
  return Number(r.rows[0]?.id_usuario) === idUsuario(req)
}

function protegerModulo(modulo) {
  return async (req, res, next) => {
    try {
      if (!req.usuario) return res.status(401).json({ message: 'Entre para continuar.' })
      const method = req.method
      const segments = req.path.split('/').filter(Boolean)
      const [a,b,c,d,e] = segments
      if (req.escopo === 'cadastro') {
        if (modulo === 'propriedades' && method === 'POST' && !a && Number(req.body?.id_usuario) === idUsuario(req)) {
          const contador = await db.query('SELECT COUNT(*)::int AS total FROM propriedades WHERE id_usuario = $1', [idUsuario(req)])
          if (contador.rows[0]?.total === 0) return next()
        }
        return acessoNegado(res)
      }
      if (admin(req)) return next()
      if (modulo === 'usuarios') return acessoNegado(res)
      if (modulo === 'chamados') {
        if (method === 'GET' && !a) return next()
        if (method === 'POST' && !a && produtor(req) && Number(req.body?.id_usuario) === idUsuario(req) && await donoPropriedade(req.body?.id_propriedade, req)) return next()
        if (method === 'GET' && a && !b) return verificaChamado(req,res,next,a)
        if (method === 'PUT' && a && !b) return verificaChamado(req,res,next,a,'pendente-proprietario')
        if (method === 'DELETE' && a && !b) return verificaChamado(req,res,next,a,'pendente-proprietario')
        if (method === 'PATCH' && a && b === 'status' && tecnico(req) && Number(req.body?.id_usuario_responsavel) === idUsuario(req)) return verificaChamado(req,res,next,a,'trabalho')
      }
      if (modulo === 'propriedades') {
        if (method === 'GET' && !a) return next() // controller filtra produtor
        if (method === 'GET' && a === 'usuario' && b && !c && (tecnico(req) || Number(b) === idUsuario(req))) return next()
        if (method === 'GET' && a && !b && (tecnico(req) || (produtor(req) && await donoPropriedade(a,req)))) return next()
        if (method === 'POST' && !a && produtor(req) && Number(req.body?.id_usuario) === idUsuario(req)) return next()
        if ((method === 'PUT' || method === 'DELETE') && a && !b && produtor(req) && await donoPropriedade(a,req)) return next()
      }
      if (modulo === 'unidades') {
        if (method === 'GET' && !a) return next() // controller filtra produtor
        if (method === 'GET' && a === 'propriedade' && b && !c && (tecnico(req) || (produtor(req) && await donoPropriedade(b,req)))) return next()
        if (method === 'GET' && a && !b && (tecnico(req) || (produtor(req) && await donoUnidade(a,req)))) return next()
        if (method === 'POST' && !a && produtor(req) && await donoPropriedade(req.body?.id_propriedade,req)) return next()
        if ((method === 'PUT' || method === 'PATCH') && a && produtor(req) && await donoUnidade(a,req)) return next()
      }
      if (modulo === 'chamado-funcionarios') {
        if (a === 'chamado' && b && c === 'aceitar' && method === 'POST' && tecnico(req) && Number(req.body?.id_funcionario) === idUsuario(req)) return verificaChamado(req,res,next,b)
        if (a === 'chamado' && b && c === 'funcionario' && d && e === 'desistir' && method === 'PATCH' && tecnico(req) && Number(d) === idUsuario(req)) return verificaChamado(req,res,next,b,'trabalho')
        if (a === 'chamado' && b && method === 'GET') return verificaChamado(req,res,next,b)
        if (a === 'funcionario' && b && method === 'GET' && tecnico(req) && Number(b) === idUsuario(req)) return next()
      }
      if (modulo === 'anexos') {
        if (a === 'chamado' && b && method === 'GET') return verificaChamado(req,res,next,b)
        if (a === 'chamado' && b && method === 'POST') return verificaChamado(req,res,next,b,'anexo')
        if (a && method === 'DELETE' && !b) return verificaChamado(req,res,next,await idChamadoRelacionado('anexos_chamado','id_anexo',a),'anexo')
      }
      if (['materiais','historicos','deslocamentos'].includes(modulo)) {
        const tabela = { materiais:'materiais_utilizados', historicos:'historico_chamado', deslocamentos:'deslocamentos' }[modulo]
        const coluna = { materiais:'id_material', historicos:'id_historico', deslocamentos:'id_deslocamento' }[modulo]
        if (method === 'GET' && !a) return acessoNegado(res) // relatório geral: admin
        if (method === 'GET' && a === 'chamado' && b) return verificaChamado(req,res,next,b)
        if (method === 'GET' && a && !b) return verificaChamado(req,res,next,await idChamadoRelacionado(tabela,coluna,a))
        if (tecnico(req)) {
          if (modulo === 'deslocamentos' && a === 'chamado' && b && c === 'finalizar' && method === 'PATCH') return verificaChamado(req,res,next,b,'trabalho')
          if (method === 'POST' && !a && (!req.body?.id_funcionario || Number(req.body.id_funcionario) === idUsuario(req)) && (!req.body?.id_usuario_responsavel || Number(req.body.id_usuario_responsavel) === idUsuario(req))) return verificaChamado(req,res,next,req.body?.id_chamado,'trabalho')
          if ((method === 'PUT' || method === 'DELETE') && a && !b) return verificaChamado(req,res,next,await idChamadoRelacionado(tabela,coluna,a),'trabalho')
        }
      }
      return acessoNegado(res)
    } catch (error) {
      console.error('Erro ao verificar permissão de recurso:', error)
      return res.status(503).json({ message: 'Não foi possível verificar a permissão.' })
    }
  }
}

module.exports = { autenticar, protegerModulo, dadosChamado, podeLerChamado, acessoNegado, idUsuario, produtor, tecnico, admin }
