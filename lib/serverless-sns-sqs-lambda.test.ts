"use strict";

import CLI from "serverless/lib/classes/CLI";
import AwsProvider from "serverless/lib/plugins/aws/provider";
import ServerlessSnsSqsLambda from "./serverless-sns-sqs-lambda";

const slsOpt = {
  region: "ap-southeast-2"
};

// TODO: When upgrading to Serverless V3 we lost the ability to instantiate the Serverless object in unit tests
// This gets the unit tests working again for now but is brittle and probably just a temporary thing.
// We really need something like https://github.com/agiledigital/serverless-sns-sqs-lambda/issues/313
const generateServerlessMock = () => ({
  name: "unit-test",
  config: {
    stage: "dev"
  },
  service: {
    provider: {
      name: "unit-test",
      stage: "dev"
    }
  },
  getProvider: jest.fn().mockReturnValue(jest.fn()),
  setProvider: jest.fn(),
  configSchemaHandler: {
    defineFunctionEvent: jest.fn()
  }
});

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
      serverless = generateServerlessMock();
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
      serverless = generateServerlessMock();
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
      serverless = generateServerlessMock();
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
      serverless = generateServerlessMock();
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
          `"Generated logical ID [Event1DeadLetterQueue] already exists in resources definition. Ensure that the snsSqs event definition has a unique name property."`
        );
      });
    });

    describe("when the generated queue names are too long (over 80 characters)", () => {
      describe("when omitPhysicalId is false", () => {
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
                      prefix: "something-really-long-that-puts-it-",
                      name: "over-80-characters-which-is-no-good",
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
          };

          expect(thunk).toThrowErrorMatchingInlineSnapshot(
            `"Generated queue name [something-really-long-that-puts-it-over-80-characters-which-is-no-goodDeadLetterQueue] is longer than 80 characters long and may be truncated by AWS, causing naming collisions. Try a shorter prefix or name, or try the hashQueueName config option."`
          );
        });
      });
    });
    describe("when omitPhysicalId is true", () => {
      it("should omit the queue name so that AWS can generate a unique one which is 80 chars or less", () => {
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
                    prefix: "something-really-long-that-puts-it-",
                    name: "over-80-characters-which-is-no-good",
                    topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic",
                    omitPhysicalId: true
                  }
                }
              ]
            }
          }
        } as const;

        serverlessSnsSqsLambda.addSnsSqsResources(
          template,
          "Fn1",
          "unit-test",
          testCase.functions.Fn1.events[0].snsSqs
        );

        const regularQueueName =
          template.Resources["over-80-characters-which-is-no-goodQueue"]
            .Properties.QueueName;
        const deadLetterQueueName =
          template.Resources[
            "over-80-characters-which-is-no-goodDeadLetterQueue"
          ].Properties.QueueName;

        // AWS will do this for us
        expect(regularQueueName).toBeUndefined();
        expect(deadLetterQueueName).toBeUndefined();
      });
    });
  });
});
