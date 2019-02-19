import { Callback } from 'aws-lambda';

export default class Response {
  public static error (callback: Callback, body: any, cors: boolean = false) {
    this.buildResponse(callback, 500, body, cors);
  }

  public static success (callback: Callback, body: any, cors = false) {
    this.buildResponse(callback, 200, body, cors);
  }

  private static buildResponse (callback: Callback, statusCode: number, body: any, cors: boolean) {
    let headers = { 'Content-Type': 'application/json' };

    if (cors) {
      headers['Access-Control-Allow-Origin'] = '*';
      headers['Access-Control-Allow-Credentials'] = true;
    }

    callback(null, {
      statusCode,
      headers,
      body
    });
  }
}
