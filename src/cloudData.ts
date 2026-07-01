import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/api';
import type { AppData } from './types';

const CLOUD_RECORD_ID = 'lift-log-app-data';
let didConfigure = false;

function isCloudConfigured() {
  return Boolean(
    import.meta.env.VITE_AWS_REGION &&
    import.meta.env.VITE_AWS_APPSYNC_ENDPOINT &&
    import.meta.env.VITE_AWS_APPSYNC_API_KEY,
  );
}

function configureAmplify() {
  if (didConfigure || !isCloudConfigured()) {
    return;
  }

  Amplify.configure({
    API: {
      GraphQL: {
        endpoint: import.meta.env.VITE_AWS_APPSYNC_ENDPOINT,
        region: import.meta.env.VITE_AWS_REGION,
        defaultAuthMode: 'apiKey',
        apiKey: import.meta.env.VITE_AWS_APPSYNC_API_KEY,
      },
    },
  });

  didConfigure = true;
}

export async function loadAppDataFromCloud(): Promise<AppData | null> {
  configureAmplify();
  if (!isCloudConfigured()) {
    return null;
  }

  try {
    const client = generateClient();
    const result = await client.graphql({
      query: /* GraphQL */ `
        query ListAppDataRecords($filter: ModelAppDataRecordFilterInput) {
          listAppDataRecords(filter: $filter) {
            items {
              id
              payload
            }
          }
        }
      `,
      variables: {
        filter: { id: { eq: CLOUD_RECORD_ID } },
      },
    }) as { data?: { listAppDataRecords?: { items?: Array<{ id: string; payload: string }> } } };

    const record = result.data?.listAppDataRecords?.items?.[0];
    if (!record?.payload) {
      return null;
    }

    return JSON.parse(record.payload) as AppData;
  } catch {
    return null;
  }
}

export async function saveAppDataToCloud(data: AppData) {
  configureAmplify();
  if (!isCloudConfigured()) {
    return;
  }

  try {
    const client = generateClient();
    const payload = JSON.stringify(data);

    const existing = await loadAppDataFromCloud();
    if (existing) {
      await client.graphql({
        query: /* GraphQL */ `
          mutation UpdateAppDataRecord($input: UpdateAppDataRecordInput!) {
            updateAppDataRecord(input: $input) {
              id
              payload
            }
          }
        `,
        variables: {
          input: {
            id: CLOUD_RECORD_ID,
            payload,
          },
        },
      });
      return;
    }

    await client.graphql({
      query: /* GraphQL */ `
        mutation CreateAppDataRecord($input: CreateAppDataRecordInput!) {
          createAppDataRecord(input: $input) {
            id
            payload
          }
        }
      `,
      variables: {
        input: {
          id: CLOUD_RECORD_ID,
          payload,
        },
      },
    });
  } catch {
    // Fall back to local storage if the cloud backend is unavailable.
  }
}
