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
const defaultView: ReactElement = createElement(OwnIDEliteView, {});

// @ts-expect-error Context belongs on a scoped namespace, not the View.
const contextProp: OwnIDEliteViewProps = { context: { loginId: 'user@example.com' } };
// @ts-expect-error Instance selection uses an Elite namespace.
const instanceNameProp: OwnIDEliteViewProps = { instanceName: 'checkout' };
// @ts-expect-error The application controls layout around the View.
const styleProp: OwnIDEliteViewProps = { style: { flex: 1 } };
// @ts-expect-error Elite origins cannot be null.
const nullOrigin: OwnIDEliteOptions = { origin: null };
// @ts-expect-error Event handlers retain their asynchronous public contract.
const synchronousClose: OwnIDEliteViewProps = { events: { onClose: () => undefined } };
// @ts-expect-error Session providers return a Promise.
const synchronousProvider: OwnIDEliteViewProps = { providers: { session: { create: () => ({ status: 'logged-in' }) } } };

void view;
void defaultView;
void contextProp;
void instanceNameProp;
void styleProp;
void nullOrigin;
void synchronousClose;
void synchronousProvider;
