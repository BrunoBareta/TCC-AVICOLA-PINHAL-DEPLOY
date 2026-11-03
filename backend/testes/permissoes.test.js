const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const databasePath = require.resolve('../src/database/db')
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: {
  async query(sql, params) {
    if (sql.includes('FROM chamados c')) {
      const id = params[0]
      const chamado = id === 10 ? {id_chamado:10,id_usuario:1,status:'PENDENTE',atribuido:false} :
        id === 20 ? {id_chamado:20,id_usuario:2,status:'ACEITO',atribuido:false} : null
      return { rows: chamado ? [chamado] : [] }
    }
    if (sql.includes('FROM propriedades')) return {rows:[{id_usuario:1}],rowCount:1}
    return {rows:[],rowCount:0}
  }
}}
const { protegerModulo } = require('../src/security/acesso')
async function check(modulo,method,route,usuario,body = {}) {
  const req = {method,path:route,usuario,body,escopo:'sessao'}
  let resultado
  const res = {status(s) {this.code=s;return this},json(payload){resultado={code:this.code,payload};return this}}
  await protegerModulo(modulo)(req,res,()=>{resultado={code:200}})
  return resultado?.code
}
const p = {id_usuario:1,tipo_usuario:'PRODUTOR'}
const t = {id_usuario:3,tipo_usuario:'FUNCIONARIO'}
const a = {id_usuario:4,tipo_usuario:'ADMINISTRADOR'}
test('produtor não lê ou altera chamado alheio',async()=>{
 assert.equal(await check('chamados','GET','/20',p),403)
 assert.equal(await check('chamados','PUT','/20',p),403)
 assert.equal(await check('chamados','GET','/10',p),200)
 assert.equal(await check('chamados','DELETE','/10',p),200)
})
test('técnico lê pendente, não altera atribuição inexistente',async()=>{
 assert.equal(await check('chamados','GET','/10',t),200)
 assert.equal(await check('chamados','GET','/20',t),403)
 assert.equal(await check('chamados','PATCH','/20/status',t,{id_usuario_responsavel:3}),403)
})
test('admin tem acesso e token de cadastro não herda privilégios',async()=>{
 assert.equal(await check('chamados','GET','/20',a),200)
 assert.equal(await check('chamados','DELETE','/20',a),200)
})
