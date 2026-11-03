const fs = require('fs')
const vm = require('vm')
const assert = require('assert')
const path = require('path')
const arquivo = path.join(__dirname,'..','src','boot','axios.js')
let codigo = fs.readFileSync(arquivo,'utf8')
codigo = codigo.replace(/^import axios from 'axios'\s*\n/m,'')
codigo = codigo.replaceAll('import.meta.env.VITE_API_URL', '({ VITE_API_URL: "" }).VITE_API_URL')
codigo = codigo.replace(/^export default.*\nexport \{ api \}\s*$/m,'')
let requisicao, respostaErro
const axios = { create() { return { interceptors: {
  request: {use(fn){ requisicao=fn }},
  response: {use(ok,err){ respostaErro=err }}
} } } }
const valores = {usuario:'{"tipo_usuario":"FUNCIONARIO"}',token:'TOKEN_TECNICO'}
const removidos=[]
const localStorage={ getItem(k){return valores[k] || null}, removeItem(k){removidos.push(k); delete valores[k]} }
const sessionStorage={getItem(){return null},removeItem(k){removidos.push('session:'+k)}}
const window={location:{hostname:'localhost',protocol:'http:',hash:'#/cadastro'}}
vm.runInNewContext(codigo,{axios,localStorage,sessionStorage,window,console,Error,Promise})
const headers = {Authorization:'Bearer TOKEN_CADASTRO',get(name){return this[name]}}
const c1=requisicao({headers,cadastroTemporario:true})
assert.equal(c1.headers.Authorization,'Bearer TOKEN_CADASTRO','não deve sobrescrever token de cadastro')
const c2=requisicao({headers:{}})
assert.equal(c2.headers.Authorization,'Bearer TOKEN_TECNICO','sessão normal deve usar token logado');
(async()=>{
  try { await respostaErro({config:{url:'/propriedades',cadastroTemporario:true},response:{status:401}}) } catch {}
  assert.equal(valores.token,'TOKEN_TECNICO','401 do cadastro não deve encerrar a sessão técnica')
  console.log('OK: token de cadastro preservado; token de sessão preservado; 401 de cadastro não encerra outra sessão.')
})().catch(e=>{console.error(e);process.exitCode=1})
