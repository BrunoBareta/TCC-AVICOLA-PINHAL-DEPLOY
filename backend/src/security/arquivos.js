const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const db = require('../database/db')
const { segredoToken } = require('./credenciais')
const uploadsDir = path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads','chamados'))
function assinatura(arquivo, expira) {
  return crypto.createHmac('sha256', segredoToken()).update(`${arquivo}:${expira}`).digest('base64url')
}
function urlAssinada(caminho) {
  const arquivo = path.basename(String(caminho || ''))
  const expira = Math.floor(Date.now() / 1000) + 15 * 60
  return `/uploads/chamados/${encodeURIComponent(arquivo)}?exp=${expira}&sig=${assinatura(arquivo,expira)}`
}
async function rotaArquivoAssinado(req,res) {
  const arquivo = req.params.arquivo
  const expira = Number(req.query.exp)
  const sig = String(req.query.sig || '')
  if (!/^[a-zA-Z0-9._-]{8,150}$/.test(arquivo) || !Number.isInteger(expira) || expira < Math.floor(Date.now()/1000) || expira > Math.floor(Date.now()/1000) + 20*60) return res.sendStatus(403)
  const esperado = Buffer.from(assinatura(arquivo, expira))
  const recebido = Buffer.from(sig)
  if (recebido.length !== esperado.length || !crypto.timingSafeEqual(esperado,recebido)) return res.sendStatus(403)
  try {
    const result = await db.query('SELECT 1 FROM anexos_chamado WHERE caminho_arquivo = $1 LIMIT 1', [`/uploads/chamados/${arquivo}`])
    if (!result.rows[0]) return res.sendStatus(404)
    res.setHeader('Cache-Control','private, max-age=60')
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
    return res.sendFile(path.join(uploadsDir, arquivo), (erro)=> { if (erro && !res.headersSent) res.sendStatus(404) })
  } catch (error) {
    console.error('Falha ao consultar arquivo:',error)
    return res.sendStatus(503)
  }
}
module.exports = { uploadsDir, urlAssinada, rotaArquivoAssinado }
