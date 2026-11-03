// Rodar somente após backup verificado no banco LOCAL: CONFIRMAR_MIGRACAO_LOCAL=SIM
// Preserva a senha atual de cada usuário, convertendo-a em hash scrypt.
require('dotenv').config()
const db = require('../src/database/db')
const { hashSenha } = require('../src/security/credenciais')
async function main() {
  if (process.env.CONFIRMAR_MIGRACAO_LOCAL !== 'SIM') throw new Error('Defina CONFIRMAR_MIGRACAO_LOCAL=SIM apenas para o banco local com backup.')
  if (!['localhost','127.0.0.1','::1'].includes(process.env.DB_HOST)) throw new Error('Operação permitida somente no PostgreSQL local.')
  const cliente = await db.connect()
  try {
    await cliente.query('BEGIN')
    const result = await cliente.query('SELECT id_usuario, senha FROM usuarios FOR UPDATE')
    let count = 0
    for (const u of result.rows) {
      if (String(u.senha || '').startsWith('scrypt$')) continue
      if (typeof u.senha !== 'string' || u.senha.length < 8) {
        throw new Error(`Usuário ${u.id_usuario} possui senha com menos de 8 caracteres; redefina-a antes da migração.`)
      }
      const hash = await hashSenha(u.senha)
      await cliente.query('UPDATE usuarios SET senha = $1 WHERE id_usuario = $2',[hash,u.id_usuario])
      count++
    }
    await cliente.query('COMMIT')
    console.log('Senhas locais migradas:',count)
  } catch(e) { await cliente.query('ROLLBACK'); throw e } finally { cliente.release() }
}
main().catch(e => {console.error(e.message);process.exitCode=1}).finally(()=>db.end())
