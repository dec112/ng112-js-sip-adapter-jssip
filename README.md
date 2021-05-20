# ng112-js-sip-adapter-jssip

An adapter for [ng112-js](https://github.com/dec112/ng112-js) for using `JsSIP` as a SIP stack.

License: GNU AGPL-3.0 \
Proprietary licenses are available on request. \
Maintainer: Gabriel Unterholzer (gabriel.unterholzer@dec112.at)

## Installation

```shell
npm install ng112-js-sip-adapter-jssip
```

## Usage

This library already comes with a factory that is ready to use with `ng112-js`.

```typescript
import { Agent } from 'ng112-js/dist/node';
import { JsSipAdapter } from 'ng112-js-sip-adapter-jssip';

new Agent({
  sipAdapterFactory: JsSipAdapter.factory,
  // [...]
});
```

In addition, node environments will also need to install `jssip-node-websocket`, which is a peer dependency of `ng112-js-sip-adapter-jssip`

```shell
npm install jssip-node-websocket
```

## Build issues

Some environments may cause problems not being able to resolve JsSIP types correctly, as JsSIP does not come with types included, but they are provided by an additional package `@types/jssip`.

Build output might look like this:

```bash
Error: node_modules/ng112-js/dist/types/models/message.d.ts:81:20 - error TS2503: Cannot find namespace 'JsSIP'.
81     jssipMessage?: JsSIP.UserAgentNewMessageEvent;
```

In these cases add the following to the `compilerOptions` section in your `tsconfig.json`. \
It will tell TypeScript the location where to look for jssip types:

```json5
{
  // [...]
  "compilerOptions": {
    // [...]
    "paths": {
      "jssip" : ["node_modules/@types/jssip"]
    }
  }
}
```


More information on this: https://www.typescriptlang.org/tsconfig#paths

## Local Build

```shell
npm install
npm run build
```

---

This project was bootstrapped with [TSDX](https://tsdx.io/)
