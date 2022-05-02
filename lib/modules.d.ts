// I don't think that serverless export these types (although I only had a cursory look)
// We can have a better look as part of https://github.com/agiledigital/serverless-sns-sqs-lambda/issues/313
// Declaring these modules keeps tsc happy (they are implicitly any)
declare module "serverless/lib/classes/CLI";
declare module "serverless/lib/plugins/aws/provider";
