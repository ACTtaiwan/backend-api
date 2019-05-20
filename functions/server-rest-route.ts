import { Request, Response, NextFunction, Router } from 'express';
import * as _ from 'lodash';
import { Logger } from '../libs/dbLib2/Logger';
import {
  RequestParams,
  getStringArrayParam,
  getIntArrayParam,
  getStringArrayParamFirst,
  getIntArrayParamFirst,
  isSite
} from './private/v2/handlers';
import { IdHandler } from './private/v2/IdHandler';
import { BillHandler } from './private/v2/BillHandler';
import { PersonHandler } from './private/v2/PersonHandler';
import { ArticleSnippetHandler } from './private/v2/ArticleSnippetHandler';
import { SendGridApiHandler } from './private/sendGrid/sendGridApiHandler';
import { StripeApiHandler } from './private/stripe/stripeApiHandler';

export class ServerRoute {
  public readonly route = Router();
  private logger = new Logger('ServerRoute');

  constructor (
    private ensureAuthenticated: (req: Request, res: Response, next: NextFunction) => void
  ) {
    this.bindRoutes();
  }

  private bindRoutes () {
    // public
    this.route.get('/v2', (req, res, next) => this.handleIds(req, res, next));
    this.route.get('/v2/bills', (req, res, next) => this.handleBills(req, res, next));
    this.route.get('/v2/persons', (req, res, next) => this.handlePersons(req, res, next));
    this.route.get('/v2/article_snippets/:site', (req, res, next) => this.handleArticleSnippets(req, res, next));

    // private
    this.route.post('/subscribe/newsletter', this.ensureAuthenticated, (req, res, next) => this.handleSubscription(req, res, next));
    this.route.post('/stripe/charge', this.ensureAuthenticated, (req, res, next) => this.handleStripe(req, res, next));
  }

  private handleIds (req: Request, res: Response, next: NextFunction) {
    let params = this.initHandler(req);
    let ids = getStringArrayParam(params, 'id');
    let fields = getStringArrayParam(params, 'field');
    let lang = getStringArrayParamFirst(params, 'lang');
    IdHandler.run(ids, fields, lang)
      .then(json => res.json(json))
      .catch(err => res.status(500).json(err));
  }

  private handleBills (req: Request, res: Response, next: NextFunction) {
    let params = this.initHandler(req);
    let congresses = getIntArrayParam(params, 'congress');
    let sponsorIds = getStringArrayParam(params, 'sponsorId');
    let cosponsorIds = getStringArrayParam(params, 'cosponsorId');
    let tagIds = getStringArrayParam(params, 'tagId');
    let fields = getStringArrayParam(params, 'field');
    let lang = getStringArrayParamFirst(params, 'lang');

    BillHandler.run(congresses, sponsorIds, cosponsorIds, tagIds, fields, lang)
      .then(json => res.json(json))
      .catch(err => res.status(500).json(err));
  }

  private handlePersons (req: Request, res: Response, next: NextFunction) {
    let params = this.initHandler(req);
    let congresses = getIntArrayParam(params, 'congress');
    let states = getStringArrayParam(params, 'state');
    let districts = getIntArrayParam(params, 'district');
    let billIds = getStringArrayParam(params, 'sponsorId');
    let fields = getStringArrayParam(params, 'field');
    let lang = getStringArrayParamFirst(params, 'lang');

    PersonHandler.run(congresses, states, districts, billIds, fields, lang)
      .then(json => res.json(json))
      .catch(err => res.status(500).json(err));
  }

  private handleArticleSnippets (req: Request, res: Response, next: NextFunction) {
    let params = this.initHandler(req);
    let site = getStringArrayParamFirst(params, 'site');
    if (!isSite(site)) {
      throw Error(`Path param site contains an invalid value '${site}'`);
    }
    let before = getIntArrayParamFirst(params, 'before');
    let limit = getIntArrayParamFirst(params, 'limit');
    let fields = getStringArrayParam(params, 'field');

    ArticleSnippetHandler.run(site, before, limit, fields)
      .then(json => res.json(json))
      .catch(err => res.status(500).json(err));
  }

  private handleSubscription (req: Request, res: Response, next: NextFunction) {
    SendGridApiHandler.dispatchEvent('POST', { body: req.body })
      .then(json => res.json(json))
      .catch(err => res.status(500).json(err));
  }

  private handleStripe (req: Request, res: Response, next: NextFunction) {
    StripeApiHandler.dispatchEvent('POST', { body: req.body })
      .then(json => res.json(json))
      .catch(err => res.status(500).json(err));
  }

  private initHandler (
    req: Request,
  ): RequestParams {
    const flog = this.logger.in('initHandler');
    if (!req) {
      return {};
    }

    let params = _.assign(req.params || {}, req.query || {});
    params = _.mapValues(params, v => _.isArray(v) ? v : [v]);
    // flog.log(params);
    return params;
  }
}
