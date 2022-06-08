"use strict";
var hash = require('object-hash');

const ServerlessSnsSqsLambda = require("./serverless-sns-sqs-lambda");
const Serverless = require("serverless/lib/Serverless");
const AwsProvider = require("serverless/lib/plugins/aws/provider/awsProvider");
const CLI = require("serverless/lib/classes/CLI");

const slsOpt = {
  stage: "dev-test",
  region: "ap-southeast-2"
};

describe("Test Serverless SNS SQS Lambda", () => {
  let serverless;
  let serverlessSnsSqsLambda;
  beforeEach(() => {
    serverless = new Serverless();
    const options = {
      ...slsOpt
    };
    serverless.setProvider("aws", new AwsProvider(serverless));
    serverless.cli = new CLI(serverless);
    serverlessSnsSqsLambda = new ServerlessSnsSqsLambda(serverless, options);
  });

  afterEach(() => {
    jest.resetModules(); // reset modules after each test
  });

  it("should have one hook", () => {
    () => {
      expect(serverlessSnsSqsLambda.hooks.length).toBe(1);
      expect(serverlessSnsSqsLambda.hooks[0].keys).toBe(
        "aws:package:finalize:mergeCustomProviderResources"
      );
    };
  });

  it("should set the provider variable to an instance of AwsProvider", () =>
    expect(serverlessSnsSqsLambda.provider).toBeInstanceOf(AwsProvider));

  it("should have access to the serverless instance", () =>
    expect(serverlessSnsSqsLambda.serverless).toEqual(serverless));

  it("should set the options variable", () =>
    expect(serverlessSnsSqsLambda.options).toEqual({
      ...slsOpt
    }));

  it("should fail if name is not passed", () => {
    expect.assertions(1);
    expect(() => {
      serverlessSnsSqsLambda.validateConfig("func-name", "stage", {
        topicArn: "topicArn",
        name: undefined
      });
    }).toThrow(/name was \[undefined\]/);
  });

  it("should add the function name to the config name to make it unique", () => {
    const functionName = 'MarketplaceSubscriptionConfirmation'
    const funcNamePascalCase = functionName.slice(0, 1).toUpperCase() + functionName.slice(1);
    const hashedFunctionName = hash(funcNamePascalCase).substring(0, 10)
    const config = serverlessSnsSqsLambda.validateConfig(functionName, "stage", {
      topicArn: "topicArn",
      name: 'QueueName'
    });

    expect(config.name).toEqual(`${hashedFunctionName}-QueueName`)
  });

  it("should fail if topicArn is not passed", () => {
    expect.assertions(1);
    expect(() => {
      serverlessSnsSqsLambda.validateConfig("func-name", "stage", {
        topicArn: undefined,
        name: "name"
      });
    }).toThrow(/topicArn was \[undefined\]/);
  });
});
