import Joi from 'joi'
import GlobalSchema from '~/libs/utils/Global.schema'

let schema = {}

schema.getUserParams = Joi.object()
  .keys({
    id: Joi.string().guid(),
    fbUserId: Joi.string(),
    email: Joi.string().email()
  })
  .or('id', 'fbUserId', 'email')
  .without('id', 'fbUserId', 'email')

schema.getUserResult = Joi.object().keys({
  id: Joi.string().guid(),
  fbUserId: Joi.string(),
  email: Joi.string().email(),
  score: Joi.number(),
  clearedTaskCount: Joi.number(),
  name: Joi.string()
})

schema.createUserParams = Joi.object().keys({
  fbUserId: Joi.string(),
  email: Joi.string().email(),
  name: Joi.string()
})

schema.createUserResult = Joi.object().keys({
  id: Joi.string().guid(),
  fbUserId: Joi.string(),
  email: Joi.string().email(),
  score: Joi.number(),
  clearedTaskCount: Joi.number(),
  name: Joi.string()
})

let validate = {}

validate.getUserParams = GlobalSchema.validate.promisify(schema.getUserParams)
validate.getUserResult = GlobalSchema.validate.promisify(schema.getUserResult)
validate.createUserParams = GlobalSchema.validate.promisify(schema.createUserParams)
validate.createUserResult = GlobalSchema.validate.promisify(schema.createUserResult)

export default {
  schema,
  validate
}
