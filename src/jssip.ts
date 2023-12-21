import { DelegateObject, SipAdapter, SendMessageOptions, SipAdapterConfig, Origin, MessageError } from 'ng112-js';
import jssip, { Socket, WebSocketInterface } from 'jssip';
import { IncomingMessageEvent, OutgoingMessageEvent, UAConfiguration } from 'jssip/lib/UA';
import { IncomingResponse } from 'jssip/lib/SIPMessage';

const getSocketInterface = (endpoint: string): Socket => {
  // there are no types for NodeWebsocket
  let NodeWebsocket: any = undefined;

  // if we are on node, we try to import jssip-node-websocket, which is a peer-dependency
  try {
    NodeWebsocket = require('jssip-node-websocket');
  }
  catch { /* module could not be found */ }

  if (NodeWebsocket)
    return new NodeWebsocket(endpoint);
  else
    // if we could not load jssip-node-websocket, we'll proceed with the standard websocket interface
    return new WebSocketInterface(endpoint);
}

export class JsSipAdapter implements SipAdapter {
  static factory = (config: SipAdapterConfig & Partial<UAConfiguration>) => new JsSipAdapter(config);

  private _agent: jssip.UA;
  public delegate: DelegateObject

  constructor(config: SipAdapterConfig & Partial<UAConfiguration>) {
    const {
      endpoint,
      domain,
      user,
      displayName,
      originSipUri,
      logger,
      userAgent,
    } = config;

    // TODO: check all inputs here
    // otherwise they might cause exceptions and we think the module is not available

    // we can only activate jssip debugging if we log to the console (our fallback)
    // because jssip does not let us piping log messages somewhere else
    jssip.debug[logger.isActive() && logger.isFallback() ? 'enable' : 'disable']('JsSIP:*');

    this._agent = new jssip.UA({
      sockets: [
        getSocketInterface(endpoint),
      ],
      uri: originSipUri,
      authorization_user: user,
      realm: domain,
      display_name: displayName,
      register: true,
      
      ...config,

      // user agent must not be overwritten
      user_agent: `${userAgent} JsSIP/${jssip.version}`,
    });

    this.delegate = {
      onConnect: (callback) => { this._agent.on('connected', callback); },
      onConnecting: (callback) => { this._agent.on('connecting', callback); },
      onDisconnect: (callback) => { this._agent.on('disconnected', callback); },
      onRegister: (callback) => { this._agent.on('registered', callback); },
      onUnregister: (callback) => { this._agent.on('unregistered', callback) },
      onRegistrationFail: (callback) => { this._agent.on('registrationFailed', callback) },
      onNewMessage: (callback) => {
        this._agent.on('newMessage', (message: IncomingMessageEvent | OutgoingMessageEvent) => {
          const { request } = message;

          callback({
            accept: async (options) => {
              message.message.accept({
                body: options?.body,
                extraHeaders: options?.extraHeaders,
              })
            },
            reject: async (options) => {
              message.message.reject({
                body: options?.body,
                reason_phrase: options?.reasonPhrase ?? '',
                extraHeaders: options?.extraHeaders,
                status_code: options?.statusCode ? options.statusCode : undefined,
              })
            },
            request: {
              hasHeader: (name) => request.hasHeader(name),
              getHeader: (name) => request.getHeader(name),
              getHeaders: (name) => request.getHeaders(name),
              body: request.body,
              from: {
                displayName: request.from.display_name,
                get uri() { return request.from.uri },
              },
              to: {
                displayName: request.to.display_name,
                get uri() { return request.to.uri },
              },
              // this is fine :-)
              origin: message.originator as unknown as Origin,
              sipStackObject: message,
            }
          });
        })
      },
    }
  }
  register(): Promise<void> {
    // JsSIP handles registration automatically
    return Promise.resolve();
  }
  unregister(): Promise<void> {
    const promise = new Promise<void>(resolve => {
      this._agent.once('unregistered', () => resolve());
    });

    this._agent.unregister();

    return promise;
  }
  async start(): Promise<void> {
    const promise = Promise.all([
      new Promise<void>(resolve => this._agent.once('connected', resolve)),
      new Promise<void>(resolve => this._agent.once('registered', resolve)),
    ]);

    this._agent.start();

    await promise;
  }
  stop(): Promise<void> {
    const promise = new Promise<void>(resolve => {
      this._agent.once('disconnected', () => resolve());
    });

    this._agent.stop();

    return promise;
  }
  message(target: string, body: string, options?: SendMessageOptions): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        // we can not just pass the plain string to `sendMessage` as this causes problems with encoded parameters
        // therfore we have to call URI.parse (which is a jssip function!) to ensure correct transmission
        const targetUri = jssip.URI.parse(target);
        // throw an exception if targetUri is undefined
        if (!targetUri)
          throw new Error(`Target URI could not be parsed: ${target}`);

        this._agent.sendMessage(targetUri, body, {
          ...options,
          // one can specify a custom display name that takes precedence over the agent's display name
          fromDisplayName: options?.displayName,
          eventHandlers: {
            // TODO: include return object here
            succeeded: () => resolve(),
            failed: (evt) => {
              // evt.response can be null, even though types state otherwise...
              const response: IncomingResponse = evt.response || {};

              const error: MessageError = {
                // JsSIP Originator has the exact same structure as ng112-js Origin
                origin: evt.originator as unknown as Origin,
                reason: response.reason_phrase || evt.cause?.toString() || 'Internal Server Error',
                statusCode: response.status_code || 500,
                sipStackObject: evt,
              };
              reject(error);
            },
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }
  subscribe(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  unsubscribe(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  notify(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}