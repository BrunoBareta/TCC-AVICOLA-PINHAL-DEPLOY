const test = require('node:test')
const assert = require('node:assert/strict')
const { hashSenha, conferirSenha, emitirToken, verificarToken, usuarioPublico } = require('../src/security/credenciais')
test('senha usa hash scrypt, compara e rejeita senha incorreta', async () => {
  const hash = await hashSenha('minhasenha123')
  assert.match(hash, /^scrypt\$/)
  assert.equal(await conferirSenha('minhasenha123', hash), true)
  assert.equal(await conferirSenha('errada', hash), false)
  assert.equal(await conferirSenha('minhasenha123','minhasenha123'), false)
})
test('token assinado não aceita alteração e não mostra senha', () => {
  const usuario = { id_usuario: 5, tipo_usuario:'PRODUTOR', senha:'segredo',nome:'Teste' }
  const token = emitirToken(usuario)
  assert.equal(verificarToken(token).sub,'5')
  assert.equal(verificarToken(token+'x'),null)
  assert.equal('senha' in usuarioPublico(usuario),false)
})
test('token de cadastro usa escopo separado', () => {
  const token = emitirToken({id_usuario:2,tipo_usuario:'PRODUTOR'}, 'cadastro')
  assert.equal(verificarToken(token).scope,'cadastro')
})
