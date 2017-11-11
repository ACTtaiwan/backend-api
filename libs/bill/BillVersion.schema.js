import Joi from 'joi'
import GlobalSchema from '~/libs/utils/Global.schema'

let schema = {}

// Get Bills

schema.getVersionParams = Joi.object().keys({
  id: Joi.string()
})

let validate = {}

validate.getVersionParams = GlobalSchema.validate.promisify(schema.getVersionParams)

export default {
  schema,
  validate
}
