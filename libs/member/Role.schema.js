import Joi from 'joi'
import GlobalSchema from '~/libs/utils/Global.schema'

let schema = {}

// Get Bills

schema.getRoleParams = Joi.object().keys({
  id: Joi.string()
})

schema.getRolesParams = Joi.object().keys({
  query: Joi.object()
})

let validate = {}

validate.getRoleParams = GlobalSchema.validate.promisify(schema.getRoleParams)
validate.getRolesParams = GlobalSchema.validate.promisify(schema.getRolesParams)

export default {
  schema,
  validate
}
