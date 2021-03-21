import * as functions from "firebase-functions";

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// http://localhost:5001/ian-oauth-dev/us-central1/helloWorld?name=ian
export const helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info("Hello logs!", {structuredData: true});
  response.send(`Hello, ${request.query["name"]} from Firebase!`);
});

export const oidc = functions.https.onRequest((request, response) => {
  functions.logger.info("[OIDC] request",
      {structuredData: true, request: request});
  response.send(`Hello, ${request.query["name"]} from Firebase!`);
});
