// Executar somente no banco de testes: node scripts/criar-admin-teste.js email@dominio.com "Nome"
// Gera senha aleatória no terminal e grava hash, não armazena credenciais no Git.
require('dotenv').config()
const crypto = require('crypto')
const db = require('../src/database/db')
const { hashSenha } = require('../src/security/credenciais')
async function main() {
  const email = String(process.argv[2] || '').trim().toLowerCase()
  const nome = String(process.argv[3] || 'Administrador de teste').trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('Uso: node scripts/criar-admin-teste.js email@dominio.com "Nome"')
  }
  if (process.env.CONFIRMAR_AMBIENTE_TESTE !== 'SIM') {
    throw new Error('Defina CONFIRMAR_AMBIENTE_TESTE=SIM para evitar cadastro acidental em produção.')
  }
  const existente = await db.query('SELECT id_usuario FROM usuarios WHERE LOWER(email) = LOWER($1)', [email])
  if (existente.rowCount) throw new Error('Já existe uma conta com esse e-mail.')
  const senhaInicial = crypto.randomBytes(20).toString('base64url')
  const senha = await hashSenha(senhaInicial)
  const resultado = await db.query(`INSERT INTO usuarios (nome, telefone, email, cpf_cnpj, senha, tipo_usuario, foto_perfil, ativo, data_cadastro)
    VALUES ($1,NULL,$2,NULL,$3,'ADMINISTRADOR',NULL,TRUE,NOW()) RETURNING id_usuario`, [nome, email, senha])
  console.log('Administrador criado:', resultado.rows[0].id_usuario)
  console.log('Senha inicial (guarde fora do código/Git e altere no primeiro login):', senhaInicial)
}
main().catch(e => { console.error(e.message); process.exitCode = 1 }).finally(()=> db.end())
