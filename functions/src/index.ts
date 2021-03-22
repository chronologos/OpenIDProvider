import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { signJwt } from "./signer";

// http://localhost:5001/ian-oauth-dev/us-central1/helloWorld?name=ian
// https://cloud.google.com/functions/docs/securing/function-identity
// Cloud Functions can be configured with a specific service account identity.
const DOMAIN = "https://ian-oauth-dev.web.app";
const SERVICE_ACCOUNT =
  "firebase-adminsdk-ciojm@ian-oauth-dev.iam.gserviceaccount.com";
const ACCESS_TOKEN = "ianaccesstoken";
const REFRESH_TOKEN = "ianrefreshtoken";
const TEST_CLIENTID = "ian-oidc-test-clientid";

// helloWorld merely logs the request (logs can be viewed in Cloud Logging).
export const helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info("[OIDC] request", {
    structuredData: true,
    request: request,
  });
  response.send(`Hello, ${request.query["name"]} from Firebase!`);
});

// Webfinger-backed OIDC discovery doc.
export const oidc = functions.https.onRequest((request, response) => {
  functions.logger.info("[OIDC] request", {
    structuredData: true,
    request: request,
  });
  // https://cloud.google.com/iam/docs/creating-managing-service-account-keys#creating_service_account_keys
  // Google SA JWKs are made available automatically by Google.
  response.status(200).json(discovery);
});

// https://ian-oauth-dev.web.app/connect/authorize?response_type=id_token&client_id=ian-oidc-test-clientid&redirect_uri=https%3A%2F%2Fian-oauth-dev.firebaseapp.com%2F__%2Fauth%2Fhandler&state=AMbdmDnk1T30g7XXhXCWUpRWeRa5_NHQgROJ8yLr96l2LhumtXzAGVFcdcBSjKk6WhDutjdqE1bJSiNWgm_wqIJnQp_4TiOAYaOtVdqTxu_JxK9W0LuGdXVpEsj1BZKlanAcyydNprBOofY0HCkwtwSImNQ25fE_fmrRxnNW8Sk97XlYIgvs4aNE2k9ZvO7azTc1UXLrxRp7_jPqBz2v5wphsm5RMTYNDj7KCOU4YZMuOg0D9dx7xzkNR3Q333UaL5HDwQRvMZSB3jZ5RgxCq_fpqCSNsw-pCOxa5ufmh__lmGgEIZLSqSRO0CNamzBXUULPL215a3DyLzsI4lw_mqt6oQ&scope=openid%20email%20profile&nonce=738efe66dae30e7cbc2c8213522ff24f351636f94be58bd10769126f38c1a6b4&context_uri=https%3A%2F%2Fian-oauth-dev.web.app
// OIDC/OAuth2.0 Authorization Endpoint (implicit flow).
export const authorize = functions.https.onRequest(
  async (request, response) => {
    functions.logger.info("[OIDC] authorize request", {
      structuredData: true,
      request: request,
    });
    const {
      response_type: responseType,
      client_id: clientID,
      redirect_uri: redirectURI,
      state,
      scope,
      nonce,
      context_uri: contextURI,
    } = request.query;
    if (responseType != "id_token") {
      functions.logger.error(
        `responseType must be id_token, got ${responseType}`
      );
      response
        .status(400)
        .send(`responseType must be id_token, got ${responseType}`);
      return;
    }
    if (clientID == null || clientID == "") {
      functions.logger.error("clientID must be present");
      response.status(400).send("clientID must be present");
      return;
    }
    if (redirectURI == null || redirectURI == "") {
      functions.logger.error("redirectURI must be present");
      response.status(400).send("redirectURI must be present");
      return;
    }
    if (state == null || state == "") {
      functions.logger.error("state cannot be empty");
      response.status(400).send("state cannot be empty");
      return;
    }
    if (scope == "") {
      functions.logger.error("scope cannot be empty");
      response.status(400).send("scope cannot be empty");
      return;
    }
    if (nonce == "") {
      functions.logger.error("nonce cannot be empty");
      response.status(400).send("nonce cannot be empty");
      return;
    }

    admin.initializeApp();
    const query = admin
      .firestore()
      .collection("clientID")
      .where("id", "==", clientID);
    const querySnapshot = await query.get();
    if (querySnapshot.size == 0) {
      admin.firestore().collection("clientID").add({ id: clientID });
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600;
    functions.logger.info(`contextURI:${contextURI}`);
    if (typeof redirectURI != "string") {
      functions.logger.error("redirectURI must be string");
      response.status(400).send("redirectURI must be string");
      return;
    }
    const claims = JSON.stringify({
      iss: `${DOMAIN}`, // The URL of your service
      sub: "users/user1234", // The UID of the user in your system
      aud: TEST_CLIENTID,
      scope: scope,
      nonce: nonce,
      iat: now,
      exp: exp,
      email: "ian@test.com",
      name: "iantay",
    });

    functions.logger.info("[OIDC] token claims", {
      structuredData: true,
      claims: claims,
    });

    let payload: string | null | undefined;
    try {
      payload = await signJwt(SERVICE_ACCOUNT, claims);
    } catch (err) {
      functions.logger.error("[OIDC] token error", {
        structuredData: true,
        error: err,
      });
      response.status(500).send("signing failed");
    }
    if (payload == null) {
      response.status(400).send("bad redirect URI");
      return;
    }
    const resp = {
      access_token: ACCESS_TOKEN,
      token_type: "Bearer",
      refresh_token: REFRESH_TOKEN,
      expires_in: 3600,
      id_token: payload,
    };
    functions.logger.info("[OIDC] token resp", {
      structuredData: true,
      resp: resp,
    });
    const idpRedirectURI = `${redirectURI}?access_token=${ACCESS_TOKEN}&token_type=bearer&id_token=${payload}&expires_in=3600&state=${state}&refresh_token=${REFRESH_TOKEN}`;
    functions.logger.info(`idpRedirectURI:${idpRedirectURI}`);
    functions.logger.info("[OIDC] done, redirecting");
    response.redirect(idpRedirectURI);
  }
);

const discovery = {
  issuer: `${DOMAIN}`,
  authorization_endpoint: `${DOMAIN}/connect/authorize`,
  token_endpoint: `${DOMAIN}/connect/token`,
  token_endpoint_auth_methods_supported: [
    "client_secret_post",
    "client_secret_basic",
    "private_key_jwt",
  ],
  token_endpoint_auth_signing_alg_values_supported: ["RS256", "ES256"],
  userinfo_endpoint: `${DOMAIN}/connect/userinfo`,
  check_session_iframe: `${DOMAIN}/connect/check_session`,
  end_session_endpoint: `${DOMAIN}/connect/end_session`,
  jwks_uri:
    "https://www.googleapis.com/service_accounts/v1/jwk/firebase-adminsdk-ciojm@ian-oauth-dev.iam.gserviceaccount.com",
  registration_endpoint: `${DOMAIN}/connect/register`,
  scopes_supported: ["openid", "profile", "email", "offline_access"],
  response_types_supported: ["id_token", "token id_token"],
  acr_values_supported: [
    "urn:mace:incommon:iap:silver",
    "urn:mace:incommon:iap:bronze",
  ],
  subject_types_supported: ["public", "pairwise"],
  userinfo_signing_alg_values_supported: ["RS256", "ES256", "HS256"],
  userinfo_encryption_alg_values_supported: ["RSA1_5", "A128KW"],
  userinfo_encryption_enc_values_supported: ["A128CBC-HS256", "A128GCM"],
  id_token_signing_alg_values_supported: ["RS256", "ES256", "HS256"],
  id_token_encryption_alg_values_supported: ["RSA1_5", "A128KW"],
  id_token_encryption_enc_values_supported: ["A128CBC-HS256", "A128GCM"],
  request_object_signing_alg_values_supported: ["none", "RS256", "ES256"],
  display_values_supported: ["page", "popup"],
  claim_types_supported: ["normal", "distributed"],
  claims_supported: [
    "sub",
    "iss",
    "auth_time",
    "acr",
    "name",
    "given_name",
    "family_name",
    "nickname",
    "profile",
    "picture",
    "website",
    "email",
    "email_verified",
    "locale",
    "zoneinfo",
    "http://example.info/claims/groups",
  ],
  claims_parameter_supported: true,
  service_documentation:
    "http://server.example.com/connect/service_documentation.html",
  ui_locales_supported: ["en-US", "en-GB", "en-CA", "fr-FR", "fr-CA"],
};
