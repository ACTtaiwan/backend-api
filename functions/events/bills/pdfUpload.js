import Response from '~/libs/utils/Response'

export async function main (event, context, callback) {
  let response = {
    test: 'PDF uploaded!!!'
  }

  Response.success(callback, JSON.stringify(response), true)
}
