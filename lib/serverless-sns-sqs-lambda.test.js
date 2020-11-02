"use strict";

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

  it("should fail if topicArn is not passed", () => {
    expect.assertions(1);
    expect(() => {
      serverlessSnsSqsLambda.validateConfig("func-name", "stage", {
        topicArn: undefined,
        name: "name"
      });
    }).toThrow(/topicArn was \[undefined\]/);
  });

  describe("when encryption parameters are provided", () => {
    it("should produce valid SQS CF template items", () => {
      const template = { Resources: {} };
      const testConfig = { 
        name: "some name", 
        prefix: "some prefix",
        maxRetryCount: 4,
        kmsMasterKeyId: "some key",
        kmsDataKeyReusePeriodSeconds: 200
      };
      serverlessSnsSqsLambda.addEventQueue(template, testConfig);
      serverlessSnsSqsLambda.addEventDeadLetterQueue(template, testConfig);
      expect(template).toMatchSnapshot();
    });
  });

  describe("when encryption parameters are not provided", () => {
    it("should produce valid SQS CF template items", () => {
      const template = { Resources: {} };
      const testConfig = { 
        name: "some name", 
        prefix: "some prefix",
        maxRetryCount: 4
      };
      serverlessSnsSqsLambda.addEventQueue(template, testConfig);
      serverlessSnsSqsLambda.addEventDeadLetterQueue(template, testConfig);
      expect(template).toMatchSnapshot();
    });
  });
});
