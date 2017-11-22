import Joi from 'joi'
import GlobalSchema from '~/libs/utils/Global.schema'

let schema = {}

// Get Categories

schema.getCategoryParams = Joi.object().keys({
  id: Joi.string()
})

let validate = {}

validate.getCategoryParams = GlobalSchema.validate.promisify(schema.getCategoryParams)

export default {
  schema,
  validate
}
