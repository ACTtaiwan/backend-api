import Joi from 'joi'
import GlobalSchema from '~/libs/utils/Global.schema'

let schema = {}

// Get Bills

schema.getTypeParams = Joi.object().keys({
  id: Joi.string(),
  code: Joi.string()
})

let validate = {}

validate.getTypeParams = GlobalSchema.validate.promisify(schema.getTypeParams)

export default {
  schema,
  validate
}
