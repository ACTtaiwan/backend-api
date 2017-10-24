import Joi from 'joi'
import GlobalSchema from '~/libs/utils/Global.schema'

let schema = {}

// Get Bills

schema.getBillsParams = Joi.object().keys({
  id: Joi.string()
})

let validate = {}

validate.getBillsParams = GlobalSchema.validate.promisify(schema.getBillsParams)

export default {
  schema,
  validate
}
