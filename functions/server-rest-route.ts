import { Request, Response, NextFunction, Router } from 'express';
import * as _ from 'lodash';
import { Logger } from '../libs/dbLib2/Logger';
import { IdHandler } from './private/v2/IdHandler';
import { BillHandler } from './private/v2/BillHandler';
import { PersonHandler } from './private/v2/PersonHandler';
import { ArticleSnippetHandler } from './private/v2/ArticleSnippetHandler';
import { SendGridApiHandler } from './private/sendGrid/sendGridApiHandler';
import { StripeApiHandler } from './private/stripe/stripeApiHandler';
import { RequestParams } from './private/v2/RequestParams';
import { RequestHandlerBase } from './private/v2/RequestHandlerBase';
import { IEnt, DataGraph } from '../libs/dbLib2';
import { AssocFieldsProcessor } from './private/v2/AssocFieldsProcessor';
import { CongressRolesFieldProcessor } from './private/v2/CongressRolesFieldProcessor';
import { LanguageProcessor } from './private/v2/LanguageProcessor';
import { EntTypeProcessor } from './private/v2/EntTypeProcessor';

export class ServerRoute {
  public readonly route = Router();
  private logger = new Logger('ServerRoute');

  constructor (
    private ensureAuthenticated: (
      req: Request,
      res: Response,
      next: NextFunction
    ) => void
  ) {
    this.bindRoutes();
  }

  private bindRoutes () {
    // public
    this.route.get('/v2', (req, res, next) => this.handleIds(req, res, next));
    this.route.get('/v2/bills', (req, res, next) =>
      this.handleBills(req, res, next)
    );
    this.route.get('/v2/persons', (req, res, next) =>
      this.handlePersons(req, res, next)
    );
    this.route.get('/v2/article_snippets/:site', (req, res, next) =>
      this.handleArticleSnippets(req, res, next)
    );

    // private
    this.route.post(
      '/subscribe/newsletter',
      this.ensureAuthenticated,
      (req, res, next) => this.handleSubscription(req, res, next)
    );
    this.route.post(
      '/stripe/charge',
      this.ensureAuthenticated,
      (req, res, next) => this.handleStripe(req, res, next)
    );
  }

  private async handleIds (req: Request, res: Response, _next: NextFunction) {
    try {
      let dataGraph = await DataGraph.getDefault();
      let params = this.getRequestParams(req);
      let handler: RequestHandlerBase<IEnt> = new IdHandler(dataGraph);
      handler = new AssocFieldsProcessor(dataGraph, handler);
      handler = new CongressRolesFieldProcessor(handler);
      handler = new LanguageProcessor(handler);
      handler = new EntTypeProcessor(handler);

      let json = await handler.run(params);
      res.json(json);
    } catch (err) {
      res.status(500).json(err);
    }
  }

  private async handleBills (req: Request, res: Response, _next: NextFunction) {
    try {
      let dataGraph = await DataGraph.getDefault();
      let params = this.getRequestParams(req);
      let handler: RequestHandlerBase<IEnt> = new BillHandler(dataGraph);
      handler = new AssocFieldsProcessor(dataGraph, handler);
      handler = new LanguageProcessor(handler);
      handler = new EntTypeProcessor(handler);

      let json = await handler.run(params);
      res.json(json);
    } catch (err) {
      res.status(500).json(err);
    }
  }

  private async handlePersons (
    req: Request,
    res: Response,
    _next: NextFunction
  ) {
    try {
      let dataGraph = await DataGraph.getDefault();
      let params = this.getRequestParams(req);
      let handler: RequestHandlerBase<IEnt> = new PersonHandler(dataGraph);
      handler = new AssocFieldsProcessor(dataGraph, handler);
      handler = new CongressRolesFieldProcessor(handler);
      handler = new LanguageProcessor(handler);
      handler = new EntTypeProcessor(handler);

      let json = await handler.run(params);
      res.json(json);
    } catch (err) {
      res.status(500).json(err);
    }
  }

  private async handleArticleSnippets (
    req: Request,
    res: Response,
    _next: NextFunction
  ) {
    try {
      let dataGraph = await DataGraph.getDefault();
      let params = this.getRequestParams(req);
      let handler: RequestHandlerBase<IEnt> = new ArticleSnippetHandler(
        dataGraph
      );
      handler = new EntTypeProcessor(handler);

      let json = await handler.run(params);
      res.json(json);
    } catch (err) {
      res.status(500).json(err);
    }
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

  private getRequestParams (req: Request): RequestParams {
    const flog = this.logger.in('getRequestParams');
    if (!req) {
      return new RequestParams({});
    }

    let params = _.assign(req.params || {}, req.query || {});
    params = _.mapValues(params, v => (_.isArray(v) ? v : [v]));
    flog.log(params);
    return new RequestParams(params);
  }
}
