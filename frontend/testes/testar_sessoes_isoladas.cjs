const fs = require('node:fs')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const raw = fs.readFileSync(path.join(root, 'src/services/authService.js'), 'utf8')
const code = raw
  .replace(/^import .*\n/m, '')
  .replace('export default {', 'globalThis.authService = {')
function storage() {
  const m = new Map()
  return {
    getItem(k) { return m.has(k) ? m.get(k) : null },
    setItem(k,v) { m.set(k,String(v)) },
    removeItem(k) { m.delete(k) }
  }
}
const local = storage() // intencionalmente compartilhado como navegador
function abrirAba() {
  const sessao = storage() // sessionStorage independente em cada aba
  const contexto = { localStorage:local, sessionStorage:sessao, api:{post:async()=>({data:{}})}, console }
  vm.runInNewContext(code,contexto)
  return { auth:contexto.authService, sessao }
}
const admin = abrirAba()
const tecnico = abrirAba()
admin.auth.salvarToken('token-admin')
admin.auth.salvarUsuario({ id_usuario:1,nome:'Admin',tipo_usuario:'ADMINISTRADOR' })
tecnico.auth.salvarToken('token-tecnico')
tecnico.auth.salvarUsuario({ id_usuario:2,nome:'Tecnico',tipo_usuario:'FUNCIONARIO' })
assert.equal(admin.auth.getUsuarioLogado().tipo_usuario, 'ADMINISTRADOR')
assert.equal(tecnico.auth.getUsuarioLogado().tipo_usuario, 'FUNCIONARIO')
assert.equal(admin.sessao.getItem('token'),'token-admin')
assert.equal(tecnico.sessao.getItem('token'),'token-tecnico')
// Credenciais compartilhadas pela versão antiga não podem substituir uma sessão atual.
local.setItem('usuario', JSON.stringify({nome:'Outro',tipo_usuario:'PRODUTOR'}))
local.setItem('token','token-antigo')
assert.equal(admin.auth.getUsuarioLogado().tipo_usuario,'ADMINISTRADOR')
assert.equal(tecnico.auth.getUsuarioLogado().tipo_usuario,'FUNCIONARIO')
admin.auth.logout()
assert.equal(admin.auth.getUsuarioLogado(),null)
assert.equal(tecnico.auth.getUsuarioLogado().tipo_usuario,'FUNCIONARIO')
assert.equal(local.getItem('token'),null)
console.log('OK: sessões independentes por aba; token e perfil não se misturam; logout isolado.')
