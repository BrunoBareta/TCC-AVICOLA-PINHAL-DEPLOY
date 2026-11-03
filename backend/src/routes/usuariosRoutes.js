const express = require('express')
const router = express.Router()
const controller = require('../controllers/usuarioController')
const redefinir = require('../controllers/redefinicaoSenhaController')
const { autenticar, acessoNegado } = require('../security/acesso')
const { limitar } = require('../security/limite')

const somenteAdmin = (req, res, next) => req.usuario.tipo_usuario === 'ADMINISTRADOR' && req.escopo === 'sessao' ? next() : acessoNegado(res)
const proprioOuAdmin = (req, res, next) =>
  req.escopo === 'sessao' && (req.usuario.tipo_usuario === 'ADMINISTRADOR' || Number(req.params.id) === Number(req.usuario.id_usuario)) ? next() : acessoNegado(res)
const desativar = (req, res, next) => {
  if (req.escopo === 'cadastro' && Number(req.params.id) === Number(req.usuario.id_usuario)) return next()
  if (req.escopo === 'sessao' && req.usuario.tipo_usuario === 'ADMINISTRADOR' && Number(req.params.id) !== Number(req.usuario.id_usuario)) return next()
  return acessoNegado(res)
}

// Endpoints públicos (cadastro é sempre PRODUTOR no controller).
router.post('/login', limitar(12, 15 * 60 * 1000), controller.login)
router.post('/usuarios', limitar(8, 60 * 60 * 1000), controller.criar)
router.post('/senha/solicitar', limitar(5, 15 * 60 * 1000), redefinir.solicitarCodigo)
router.post('/senha/verificar', limitar(12, 15 * 60 * 1000), redefinir.verificarCodigo)
router.post('/senha/redefinir', limitar(8, 15 * 60 * 1000), redefinir.redefinirSenha)

// Rotas privadas: identidade validada no banco a cada requisição.
router.get('/usuarios', autenticar, somenteAdmin, controller.listar)
router.post('/usuarios/funcionarios', autenticar, somenteAdmin, controller.criarFuncionario)
router.get('/usuarios/:id', autenticar, proprioOuAdmin, controller.buscarPorId)
router.put('/usuarios/:id', autenticar, proprioOuAdmin, controller.atualizar)
router.delete('/usuarios/:id', autenticar, desativar, controller.deletar)
module.exports = router
