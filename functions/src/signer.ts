import { IAMCredentialsClient } from "@google-cloud/iam-credentials";
// import { GoogleAuth } from "google-auth-library";

// TODO(developer): replace with your prefered project values.
// The service account must be granted the roles/iam.serviceAccountTokenCreator role
// const serviceAccount = 'ACCOUNT_EMAIL_OR_UNIQUEID'
// const scopes = 'my-scopes', e.g., 'https://www.googleapis.com/auth/iam'

// Creates a client
const client = new IAMCredentialsClient();

// eslint-disable-next-line require-jsdoc
export async function signJwt(
  serviceAccount: string,
  payload: string | null
): Promise<string | null | undefined> {
  const [resp] = await client.signJwt({
    name: `projects/-/serviceAccounts/${serviceAccount}`,
    payload: payload,
  });
  return resp.signedJwt;
}
