import Joi from 'joi'
import GlobalSchema from '~/libs/utils/Global.schema'

let schema = {}

// Get Bills

schema.getActionParams = Joi.object().keys({
  id: Joi.string()
})

let validate = {}

validate.getActionParams = GlobalSchema.validate.promisify(schema.getActionParams)

export default {
  schema,
  validate
}
