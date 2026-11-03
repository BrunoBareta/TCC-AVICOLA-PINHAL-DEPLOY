// Limitação de tentativas em memória, adequada a uma instância de testes.
const registros = new Map()
function limitar(maximo, periodoMs) {
  return (req, res, next) => {
    const chave = `${req.ip}:${req.baseUrl}:${req.path}`
    const agora = Date.now()
    const registro = registros.get(chave)
    if (!registro || registro.expires <= agora) {
      registros.set(chave, { count: 1, expires: agora + periodoMs })
      return next()
    }
    if (registro.count >= maximo) return res.status(429).json({ message: 'Muitas tentativas. Tente novamente mais tarde.' })
    registro.count += 1
    if (registros.size > 5000) {
      for (const [key, value] of registros.entries()) if (value.expires <= agora) registros.delete(key)
    }
    next()
  }
}
module.exports = { limitar }
