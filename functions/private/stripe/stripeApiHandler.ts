import { Context, Callback, APIGatewayEvent } from 'aws-lambda';
import Response from '../../../libs/utils/Response';
import * as Stripe from 'stripe';
import { MailigenAgent } from '../../../libs/subscribe/MailigenAgent';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
stripe.setApiVersion('2019-03-14');

const sourceMap = ['U.S. Taiwan Watch', 'American Citizens for Taiwan'];

export interface StripeHandlerParams {
  body?: {
    token?: string;
    email?: string;
    amount?: number;
    currency?: string;
    description?: string;
  };
  pathAndQsp?: {
    path: string;
    token?: string;
    email?: string;
    amount?: number;
    currency?: string;
    description?: string;
  };
}

export class StripeApiHandler {
  public static handleRequest(event: APIGatewayEvent, context: Context, callback?: Callback) {
    console.log(`[StripeApiHandler::handleRequest()] event = ${JSON.stringify(event, null, 2)}`);

    // This freezes node event loop when callback is invoked
    context.callbackWaitsForEmptyEventLoop = false;

    let body = JSON.parse(event.body) || undefined;
    let params: StripeHandlerParams = {
      body,
      pathAndQsp: {
        path: event.path,
        ...event.queryStringParameters,
        ...event.pathParameters
      }
    };

    let promise = StripeApiHandler.dispatchEvent(event.httpMethod, params);
    if (promise) {
      promise
        .then(response => {
          Response.success(callback, JSON.stringify(response), true);
        })
        .catch(error => {
          Response.error(callback, JSON.stringify(error), true);
        });
    } else {
      Response.error(callback, `No Handler For Request: ${JSON.stringify(event, null, 2)}`, true);
    }
  }

  public static async getCustomer(params: StripeHandlerParams) {
    let source = 'unknown source';
    let customer: Stripe.customers.ICustomer;

    // check if the donor has registered as Customer or not.
    const lookup = await stripe.customers.list({ email: params.body.email });

    if (lookup.data.length === 0) {
      // create a customer
      sourceMap.forEach(item => {
        if (params.body.description.includes(item)) {
          source = item;
        }
      });

      customer = await stripe.customers.create({
        description: `Customer for ${source}`,
        email: params.body.email
      });
    } else {
      // assign the customer
      customer = lookup.data[0];
    }

    return customer;
  }

  public static async updateSource(params: StripeHandlerParams, customer: Stripe.customers.ICustomer) {
    const source = await stripe.customers.update(customer.id, {
      source: params.body.token
    });

    return source;
  }

  public static async dispatchEvent(httpMethod: string, params: StripeHandlerParams): Promise<any> {
    if (httpMethod === 'POST' && params.body) {
      const customer = await StripeApiHandler.getCustomer(params);
      const source = await StripeApiHandler.updateSource(params, customer);

      console.log(`[StripeApiHandler::handleRequest()] source = ${JSON.stringify(source, null, 2)}`);

      return stripe.charges.create({
        amount: params.body.amount,
        currency: params.body.currency,
        customer: source.id,
        source: source.default_source,
        description: params.body.description
      });
    }
  }
}

export let main = StripeApiHandler.handleRequest;
