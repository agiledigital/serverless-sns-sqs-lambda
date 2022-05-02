"use strict";

import CLI from "serverless/lib/classes/CLI";
import AwsProvider from "serverless/lib/plugins/aws/provider";
import Serverless from "serverless/lib/Serverless";
import ServerlessSnsSqsLambda from "./serverless-sns-sqs-lambda";

const slsOpt = {
  region: "ap-southeast-2"
};

/**
 * Returns a resource that looks like what Serverless generates when not using
 * a custom execution role ARN.
 *
 * It would be better to get Serverless to generate this for us but we don't
 * run in a serverless context at the moment so this is the best we have.
 */
const generateIamLambdaExecutionRole = () => ({
  IamRoleLambdaExecution: {
    Type: "AWS::IAM::Role",
    Properties: {
      AssumeRolePolicyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: {
              Service: ["lambda.amazonaws.com"]
            },
            Action: ["sts:AssumeRole"]
          }
        ]
      },
      Policies: [
        {
          PolicyName: {
            "Fn::Join": ["-", ["sns-sqs-service", "dev-sd", "lambda"]]
          },
          PolicyDocument: {
            Version: "2012-10-17",
            Statement: []
          }
        }
      ],
      Path: "/",
      RoleName: {
        "Fn::Join": [
          "-",
          [
            "sns-sqs-service",
            "dev-sd",
            {
              Ref: "AWS::Region"
            },
            "lambdaRole"
          ]
        ]
      }
    }
  }
});

describe("Test Serverless SNS SQS Lambda", () => {
  let serverless;
  let serverlessSnsSqsLambda;

  afterEach(() => {
    jest.resetModules(); // reset modules after each test
  });

  describe("when the provider is specified via a command line option", () => {
    beforeEach(() => {
      serverless = new Serverless();
      serverless.service.service = "test-service";
      const options = {
        ...slsOpt,
        stage: "dev-test"
      };
      serverless.setProvider("aws", new AwsProvider(serverless));
      serverless.cli = new CLI(serverless);
      serverlessSnsSqsLambda = new ServerlessSnsSqsLambda(serverless, options);
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
        ...slsOpt,
        stage: "dev-test"
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

    describe("when no optional parameters are provided", () => {
      it("should produce valid SQS CF template items", () => {
        const template = {
          Resources: {
            ...generateIamLambdaExecutionRole()
          }
        };
        const testConfig = {
          name: "some-name",
          topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic"
        };
        const validatedConfig = serverlessSnsSqsLambda.validateConfig(
          "test-function",
          serverlessSnsSqsLambda.stage,
          testConfig
        );
        serverlessSnsSqsLambda.addEventQueue(template, validatedConfig);
        serverlessSnsSqsLambda.addEventDeadLetterQueue(
          template,
          validatedConfig
        );
        serverlessSnsSqsLambda.addEventSourceMapping(template, validatedConfig);
        serverlessSnsSqsLambda.addTopicSubscription(template, validatedConfig);
        serverlessSnsSqsLambda.addLambdaSqsPermissions(
          template,
          validatedConfig
        );
        expect(template).toMatchSnapshot();
      });
    });

    describe("when all parameters are provided", () => {
      it("should produce valid SQS CF template items", () => {
        const template = {
          Resources: {
            ...generateIamLambdaExecutionRole()
          }
        };
        const testConfig = {
          name: "some-name",
          topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic",
          batchSize: 7,
          maximumBatchingWindowInSeconds: 99,
          prefix: "some prefix",
          maxRetryCount: 4,
          kmsMasterKeyId: "some key",
          kmsDataKeyReusePeriodSeconds: 200,
          deadLetterMessageRetentionPeriodSeconds: 1209600,
          enabled: false,
          visibilityTimeout: 999,
          rawMessageDelivery: true,
          filterPolicy: { pet: ["dog", "cat"] }
        };
        const validatedConfig = serverlessSnsSqsLambda.validateConfig(
          "test-function",
          serverlessSnsSqsLambda.stage,
          testConfig
        );
        serverlessSnsSqsLambda.addEventQueue(template, validatedConfig);
        serverlessSnsSqsLambda.addEventDeadLetterQueue(
          template,
          validatedConfig
        );
        serverlessSnsSqsLambda.addEventSourceMapping(template, validatedConfig);
        serverlessSnsSqsLambda.addTopicSubscription(template, validatedConfig);
        serverlessSnsSqsLambda.addLambdaSqsPermissions(
          template,
          validatedConfig
        );
        expect(template).toMatchSnapshot();
      });
    });

    describe("when encryption parameters are not provided", () => {
      it("should produce valid SQS CF template items", () => {
        const template = {
          Resources: {
            ...generateIamLambdaExecutionRole()
          }
        };
        const testConfig = {
          name: "some-name",
          topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic",
          prefix: "some prefix",
          maxRetryCount: 4
        };
        const validatedConfig = serverlessSnsSqsLambda.validateConfig(
          "test-function",
          serverlessSnsSqsLambda.stage,
          testConfig
        );
        serverlessSnsSqsLambda.addEventQueue(template, validatedConfig);
        serverlessSnsSqsLambda.addEventDeadLetterQueue(
          template,
          validatedConfig
        );
        serverlessSnsSqsLambda.addEventSourceMapping(template, validatedConfig);
        serverlessSnsSqsLambda.addTopicSubscription(template, validatedConfig);
        serverlessSnsSqsLambda.addLambdaSqsPermissions(
          template,
          validatedConfig
        );
        expect(template).toMatchSnapshot();
      });
    });

    describe("when overriding the generated CloudFormation template", () => {
      it("the overrides should take precedence", () => {
        const template = {
          Resources: {
            ...generateIamLambdaExecutionRole()
          }
        };
        const testConfig = {
          name: "some-name",
          topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic",
          prefix: "some prefix",
          maxRetryCount: 4,
          enabled: true,
          visibilityTimeout: 1234,
          deadLetterMessageRetentionPeriodSeconds: 120,
          rawMessageDelivery: true,
          mainQueueOverride: {
            visibilityTimeout: 4321
          },
          deadLetterQueueOverride: {
            MessageRetentionPeriod: 1000
          },
          eventSourceMappingOverride: {
            Enabled: false
          },
          subscriptionOverride: {
            rawMessageDelivery: false
          }
        };
        const validatedConfig = serverlessSnsSqsLambda.validateConfig(
          "test-function",
          serverlessSnsSqsLambda.stage,
          testConfig
        );
        serverlessSnsSqsLambda.addEventQueue(template, validatedConfig);
        serverlessSnsSqsLambda.addEventDeadLetterQueue(
          template,
          validatedConfig
        );
        serverlessSnsSqsLambda.addEventSourceMapping(template, validatedConfig);
        serverlessSnsSqsLambda.addTopicSubscription(template, validatedConfig);
        serverlessSnsSqsLambda.addLambdaSqsPermissions(
          template,
          validatedConfig
        );

        expect(template).toMatchSnapshot();
      });
    });

    describe("when fifo is true", () => {
      it("should produce valid fifo queues", () => {
        const template = {
          Resources: {
            ...generateIamLambdaExecutionRole()
          }
        };
        const testConfig = {
          name: "some-name",
          topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic",
          fifo: true
        };
        const validatedConfig = serverlessSnsSqsLambda.validateConfig(
          "test-function",
          serverlessSnsSqsLambda.stage,
          testConfig
        );
        serverlessSnsSqsLambda.addEventQueue(template, validatedConfig);
        serverlessSnsSqsLambda.addEventDeadLetterQueue(
          template,
          validatedConfig
        );
        serverlessSnsSqsLambda.addEventSourceMapping(template, validatedConfig);
        serverlessSnsSqsLambda.addTopicSubscription(template, validatedConfig);
        serverlessSnsSqsLambda.addLambdaSqsPermissions(
          template,
          validatedConfig
        );

        expect(template).toMatchSnapshot();
      });
    });

    describe("when a custom role ARN is specified", () => {
      it("it should not crash and just skip creating the policies", () => {
        const template = {
          Resources: {}
        };
        const testConfig = {
          name: "some-name",
          topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic"
        };
        const validatedConfig = serverlessSnsSqsLambda.validateConfig(
          "test-function",
          "test-stage",
          testConfig
        );
        serverlessSnsSqsLambda.addEventQueue(template, validatedConfig);
        serverlessSnsSqsLambda.addEventDeadLetterQueue(
          template,
          validatedConfig
        );
        serverlessSnsSqsLambda.addEventSourceMapping(template, validatedConfig);
        serverlessSnsSqsLambda.addTopicSubscription(template, validatedConfig);
        serverlessSnsSqsLambda.addLambdaSqsPermissions(
          template,
          validatedConfig
        );
        expect(template).toMatchSnapshot();
      });
    });
  });

  describe("when the provider is specified via a config option in serverless.yml", () => {
    beforeEach(() => {
      serverless = new Serverless();
      serverless.service.service = "test-service";
      // This should really be a proper instance of the Config class. See also: https://github.com/agiledigital/serverless-sns-sqs-lambda/issues/313
      serverless.config = { stage: "dev-test-config" };

      const options = {
        ...slsOpt
      };

      const provider = new AwsProvider(serverless);
      serverless.setProvider("aws", provider);

      serverless.cli = new CLI(serverless);
      serverlessSnsSqsLambda = new ServerlessSnsSqsLambda(serverless, options);
    });

    describe("when no optional parameters are provided", () => {
      it("should produce valid SQS CF template items", () => {
        const template = {
          Resources: {
            ...generateIamLambdaExecutionRole()
          }
        };
        const testConfig = {
          name: "some-name",
          topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic"
        };
        const validatedConfig = serverlessSnsSqsLambda.validateConfig(
          "test-function",
          serverlessSnsSqsLambda.stage,
          testConfig
        );
        serverlessSnsSqsLambda.addEventQueue(template, validatedConfig);
        serverlessSnsSqsLambda.addEventDeadLetterQueue(
          template,
          validatedConfig
        );
        serverlessSnsSqsLambda.addEventSourceMapping(template, validatedConfig);
        serverlessSnsSqsLambda.addTopicSubscription(template, validatedConfig);
        serverlessSnsSqsLambda.addLambdaSqsPermissions(
          template,
          validatedConfig
        );

        expect(template).toMatchSnapshot();
      });
    });

    describe("when fifo is true", () => {
      it("should produce valid fifo queues", () => {
        const template = {
          Resources: {
            ...generateIamLambdaExecutionRole()
          }
        };
        const testConfig = {
          name: "some-name",
          topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic",
          fifo: true
        };
        const validatedConfig = serverlessSnsSqsLambda.validateConfig(
          "test-function",
          serverlessSnsSqsLambda.stage,
          testConfig
        );
        serverlessSnsSqsLambda.addEventQueue(template, validatedConfig);
        serverlessSnsSqsLambda.addEventDeadLetterQueue(
          template,
          validatedConfig
        );
        serverlessSnsSqsLambda.addEventSourceMapping(template, validatedConfig);
        serverlessSnsSqsLambda.addTopicSubscription(template, validatedConfig);
        serverlessSnsSqsLambda.addLambdaSqsPermissions(
          template,
          validatedConfig
        );

        expect(template).toMatchSnapshot();
      });
    });
  });

  describe("when the provider is specified via a provider option in serverless.yml", () => {
    beforeEach(() => {
      serverless = new Serverless();
      serverless.service.service = "test-service";

      const options = {
        ...slsOpt
      };

      const provider = new AwsProvider(serverless);
      serverless.setProvider("aws", provider);
      serverless.service.provider.stage = "dev-test-provider";

      serverless.cli = new CLI(serverless);
      serverlessSnsSqsLambda = new ServerlessSnsSqsLambda(serverless, options);
    });

    describe("when no optional parameters are provided", () => {
      it("should produce valid SQS CF template items", () => {
        const template = {
          Resources: {
            ...generateIamLambdaExecutionRole()
          }
        };
        const testConfig = {
          name: "some-name",
          topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic"
        };
        const validatedConfig = serverlessSnsSqsLambda.validateConfig(
          "test-function",
          serverlessSnsSqsLambda.stage,
          testConfig
        );
        serverlessSnsSqsLambda.addEventQueue(template, validatedConfig);
        serverlessSnsSqsLambda.addEventDeadLetterQueue(
          template,
          validatedConfig
        );
        serverlessSnsSqsLambda.addEventSourceMapping(template, validatedConfig);
        serverlessSnsSqsLambda.addTopicSubscription(template, validatedConfig);
        serverlessSnsSqsLambda.addLambdaSqsPermissions(
          template,
          validatedConfig
        );

        expect(template).toMatchSnapshot();
      });
    });

    describe("when fifo is true", () => {
      it("should produce valid fifo queues", () => {
        const template = {
          Resources: {
            ...generateIamLambdaExecutionRole()
          }
        };
        const testConfig = {
          name: "some-name",
          topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic",
          fifo: true
        };
        const validatedConfig = serverlessSnsSqsLambda.validateConfig(
          "test-function",
          serverlessSnsSqsLambda.stage,
          testConfig
        );
        serverlessSnsSqsLambda.addEventQueue(template, validatedConfig);
        serverlessSnsSqsLambda.addEventDeadLetterQueue(
          template,
          validatedConfig
        );
        serverlessSnsSqsLambda.addEventSourceMapping(template, validatedConfig);
        serverlessSnsSqsLambda.addTopicSubscription(template, validatedConfig);
        serverlessSnsSqsLambda.addLambdaSqsPermissions(
          template,
          validatedConfig
        );

        expect(template).toMatchSnapshot();
      });
    });
  });

  describe("when no provider is specified", () => {
    beforeEach(() => {
      serverless = new Serverless();
      serverless.service.service = "test-service";

      const options = {
        ...slsOpt
      };
      const provider = new AwsProvider(serverless);
      serverless.setProvider("aws", provider);
      serverless.cli = new CLI(serverless);
      serverlessSnsSqsLambda = new ServerlessSnsSqsLambda(serverless, options);
    });

    describe("when no optional parameters are provided", () => {
      it("stage should default to 'dev'", () => {
        const template = {
          Resources: {
            ...generateIamLambdaExecutionRole()
          }
        };
        const testConfig = {
          name: "some-name",
          topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic"
        };
        const validatedConfig = serverlessSnsSqsLambda.validateConfig(
          "test-function",
          serverlessSnsSqsLambda.stage,
          testConfig
        );
        serverlessSnsSqsLambda.addEventQueue(template, validatedConfig);
        serverlessSnsSqsLambda.addEventDeadLetterQueue(
          template,
          validatedConfig
        );
        serverlessSnsSqsLambda.addEventSourceMapping(template, validatedConfig);
        serverlessSnsSqsLambda.addTopicSubscription(template, validatedConfig);
        serverlessSnsSqsLambda.addLambdaSqsPermissions(
          template,
          validatedConfig
        );

        expect(template).toMatchSnapshot();
      });
    });

    describe("when fifo is true", () => {
      it("stage should default to 'dev'", () => {
        const template = {
          Resources: {
            ...generateIamLambdaExecutionRole()
          }
        };
        const testConfig = {
          name: "some-name",
          topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic",
          fifo: true
        };
        const validatedConfig = serverlessSnsSqsLambda.validateConfig(
          "test-function",
          serverlessSnsSqsLambda.stage,
          testConfig
        );
        serverlessSnsSqsLambda.addEventQueue(template, validatedConfig);
        serverlessSnsSqsLambda.addEventDeadLetterQueue(
          template,
          validatedConfig
        );
        serverlessSnsSqsLambda.addEventSourceMapping(template, validatedConfig);
        serverlessSnsSqsLambda.addTopicSubscription(template, validatedConfig);
        serverlessSnsSqsLambda.addLambdaSqsPermissions(
          template,
          validatedConfig
        );

        expect(template).toMatchSnapshot();
      });
    });

    describe("when there are duplicate names", () => {
      it("should throw", () => {
        const template = {
          Resources: {
            ...generateIamLambdaExecutionRole()
          }
        };
        const testCase = {
          functions: {
            Fn1: {
              events: [
                {
                  snsSqs: {
                    name: "Event1",
                    topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic"
                  }
                }
              ]
            },
            Fn2: {
              events: [
                {
                  snsSqs: {
                    name: "Event1",
                    topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic"
                  }
                }
              ]
            }
          }
        } as const;

        const thunk = () => {
          serverlessSnsSqsLambda.addSnsSqsResources(
            template,
            "Fn1",
            "unit-test",
            testCase.functions.Fn1.events[0].snsSqs
          );
          serverlessSnsSqsLambda.addSnsSqsResources(
            template,
            "Fn2",
            "unit-test",
            testCase.functions.Fn2.events[0].snsSqs
          );
        };

        expect(thunk).toThrowErrorMatchingInlineSnapshot(
          `"Logical ID [Event1DeadLetterQueue] already exists in resources definition. Ensure that the snsSqs event definition has a unique name property."`
        );
      });
    });
  });
});
