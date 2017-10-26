class Response {
  static error (callback, body, cors = false) {
    this.buildResponse(callback, 500, body, cors)
  }

  static success (callback, body, cors = false) {
    this.buildResponse(callback, 200, body, cors)
  }

  static buildResponse (callback, statusCode, body, cors) {
    let headers = { 'Content-Type': 'application/json' }

    if (cors) {
      headers['Access-Control-Allow-Origin'] = '*'
      headers['Access-Control-Allow-Credentials'] = true
    }

    callback(null, {
      statusCode,
      headers,
      body
    })
  }
}

export default Response
