const express = require('express')
const cors = require('cors')
require('dotenv').config()
const db = require('./database/db')
const { autenticar, protegerModulo } = require('./security/acesso')
const { segredoToken } = require('./security/credenciais')
const { rotaArquivoAssinado } = require('./security/arquivos')
const app = express()

// Falhar de maneira explícita se segredos não tiverem sido configurados.
segredoToken()
if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL é obrigatória em produção.')
}
app.disable('x-powered-by')
app.set('trust proxy', 1)
const permitidas = (process.env.FRONTEND_URL || '').split(',').map(s => s.trim()).filter(Boolean)
app.use(cors({ origin(origin, callback) {
  if (!origin || permitidas.includes(origin) || (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|100\.)[^/]*$/.test(origin))) return callback(null, true)
  callback(new Error('Origem não autorizada'))
} }))
app.use(express.json({ limit: '1mb' }))
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  // Impede expor credenciais por respostas acidentais, incluindo objetos aninhados.
  const respostaOriginal = res.json.bind(res)
  res.json = (conteudo) => {
    const limpar = (valor) => {
      if (Array.isArray(valor)) return valor.map(limpar)
      // Datas vindas do PostgreSQL são objetos Date: sem este tratamento,
      // Object.entries(Date) retorna [] e a API envia {} no lugar da data.
      if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor.toISOString()
      if (valor && typeof valor === 'object') {
        return Object.fromEntries(Object.entries(valor).filter(([key]) => key !== 'senha' && key !== 'password' && key !== 'codigo_hash').map(([key, val]) => [key, limpar(val)]))
      }
      return valor
    }
    if (res.statusCode >= 500) return respostaOriginal({ message: 'Erro interno no servidor.' })
    return respostaOriginal(limpar(conteudo))
  }
  next()
})
app.get('/', (_req,res) => res.json({ message: 'API Avícola Pinhal funcionando' }))
app.get('/health', (_req,res) => res.json({ status: 'ok' }))
// Links temporários assinados para visualizar anexos em <img> e <video>.
app.get('/uploads/chamados/:arquivo', rotaArquivoAssinado)
app.use(require('./routes/usuariosRoutes'))
const modulos = [
  ['/propriedades', 'propriedades', './routes/propriedadeRoutes'],
  ['/chamados', 'chamados', './routes/chamadoRoutes'],
  ['/materiais', 'materiais', './routes/materialRoutes'],
  ['/historicos', 'historicos', './routes/historicoRoutes'],
  ['/deslocamentos', 'deslocamentos', './routes/deslocamentoRoutes'],
  ['/chamado-funcionarios', 'chamado-funcionarios', './routes/chamadoFuncionarioRoutes'],
  ['/unidades-propriedade', 'unidades', './routes/unidadePropriedadeRoutes'],
  ['/anexos', 'anexos', './routes/anexoRoutes']
]
for (const [rota, modulo, arquivo] of modulos) {
  app.use(rota, autenticar, protegerModulo(modulo), require(arquivo))
}
app.use((error, req, res, next) => {
  console.error('Erro não tratado na API:', error)
  if (res.headersSent) return next(error)
  res.status(500).json({ message: 'Erro interno no servidor.' })
})
module.exports = app
