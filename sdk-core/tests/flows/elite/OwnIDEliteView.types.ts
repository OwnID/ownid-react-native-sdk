import { createElement } from 'react';
import type { ReactElement } from 'react';

import {
  AuthMethod,
  ErrorCode,
  OwnIDEliteView,
  type OwnIDEliteNamespace,
  type OwnIDEliteOptions,
  type OwnIDEliteViewProps,
} from '../../../src';

declare const namespace: OwnIDEliteNamespace;

const options: OwnIDEliteOptions = { origin: 'https://login.example.com' };
const props: OwnIDEliteViewProps = {
  namespace,
  options,
  events: {
    onFinish: async (params) => {
      const loginId: string = params.loginId;
      const method: AuthMethod = params.authType;
      void loginId;
      void method;
    },
    onError: async (message, details) => {
      const terminal: boolean = details.terminal;
      const code: ErrorCode = details.code;
      void message;
      void terminal;
      void code;
    },
    onClose: async () => undefined,
  },
  providers: {
    session: {
      create: async (payload) => ({ status: 'logged-in', result: payload.metadata.loginId }),
    },
  },
};

const view: ReactElement = createElement(OwnIDEliteView, props);
const defaultNamespaceView: ReactElement = createElement(OwnIDEliteView, { options });
// @ts-expect-error The View requires launch options.
const missingOptionsView: ReactElement = createElement(OwnIDEliteView, {});
// @ts-expect-error Launch options require an explicit origin URL.
const missingOrigin: OwnIDEliteOptions = {};
// @ts-expect-error The View also rejects an options object without its origin.
const missingOriginView: ReactElement = createElement(OwnIDEliteView, { options: {} });

// @ts-expect-error Context belongs on a scoped namespace, not the View.
const contextProp: OwnIDEliteViewProps = { options, context: { loginId: 'user@example.com' } };
// @ts-expect-error Instance selection uses an Elite namespace.
const instanceNameProp: OwnIDEliteViewProps = { options, instanceName: 'checkout' };
// @ts-expect-error The application controls layout around the View.
const styleProp: OwnIDEliteViewProps = { options, style: { flex: 1 } };
// @ts-expect-error Elite origins cannot be null.
const nullOrigin: OwnIDEliteOptions = { origin: null };
// @ts-expect-error Event handlers retain their asynchronous public contract.
const synchronousClose: OwnIDEliteViewProps = { options, events: { onClose: () => undefined } };
// @ts-expect-error Session providers return a Promise.
const synchronousProvider: OwnIDEliteViewProps = { options, providers: { session: { create: () => ({ status: 'logged-in' }) } } };

void view;
void defaultNamespaceView;
void missingOptionsView;
void missingOrigin;
void missingOriginView;
void contextProp;
void instanceNameProp;
void styleProp;
void nullOrigin;
void synchronousClose;
void synchronousProvider;
