export type Environment = 'dev' | 'uat';

export type DemoConfiguration = Readonly<{
  environment: Environment;
  appId: string;
  eliteOrigin: string;
  demoIdentityBaseUrl: string;
}>;

export const configurations: Readonly<Record<Environment, DemoConfiguration>> = {
  dev: Object.freeze({
    environment: 'dev',
    appId: 'stxgulhdanxf5u',
    eliteOrigin: 'https://dev.ownid.com',
    demoIdentityBaseUrl: 'https://node-mongo.custom.demo.dev.ownid.com/api/auth/',
  }),
  uat: Object.freeze({
    environment: 'uat',
    appId: '4usvqc0dt3k7ol',
    eliteOrigin: 'https://uat.ownid.com',
    demoIdentityBaseUrl: 'https://node-mongo.custom.demo.staging.ownid.com/api/auth/',
  }),
};
