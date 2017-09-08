import Joi from 'joi'
import GlobalSchema from '~/libs/utils/Global.schema'

let schema = {}

// Get User

schema.getUserParams = Joi.object()
  .keys({
    id: Joi.string().guid(),
    fbUserId: Joi.string(),
    email: Joi.string().email()
  })
  .or('id', 'fbUserId', 'email')
  .without('id', 'fbUserId', 'email')

// Create User

schema.createUserParams = Joi.object().keys({
  fbUserId: Joi.string(),
  email: Joi.string().email(),
  name: Joi.string()
})

// Update Last Logged On Time

schema.updateLastLoggedOnParams = Joi.object().keys({
  id: Joi.string().guid(),
  fbUserId: Joi.string(),
  email: Joi.string().email(),
  score: Joi.number(),
  clearedTaskCount: Joi.number(),
  name: Joi.string()
})

schema.userInfo = Joi.object().keys({
  id: Joi.string().guid(),
  fbUserId: Joi.string(),
  email: Joi.string().email(),
  score: Joi.number(),
  clearedTaskCount: Joi.number(),
  name: Joi.string()
})

let validate = {}

validate.getUserParams = GlobalSchema.validate.promisify(schema.getUserParams)
validate.createUserParams = GlobalSchema.validate.promisify(schema.createUserParams)
validate.updateLastLoggedOnParams = GlobalSchema.validate.promisify(schema.updateLastLoggedOnParams)
validate.userInfo = GlobalSchema.validate.promisify(schema.userInfo)

export default {
  schema,
  validate
}
