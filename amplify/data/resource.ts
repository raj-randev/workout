import { a, defineData, type ClientSchema } from '@aws-amplify/backend';

const schema = a.schema({
  AppDataRecord: a
    .model({
      id: a.string().required(),
      payload: a.string().required(),
    })
    .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {},
  },
});
