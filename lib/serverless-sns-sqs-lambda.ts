import { JsonObject } from "type-fest";
// Future work: Properly type the file
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Defines the structure of the config object
 * that is passed to the main functions to
 * generate the Serverless template.
 */
type Config = {
  name: string;
  topicArn: string;
  funcName: string;
  prefix: string;
  batchSize: number;
  maximumBatchingWindowInSeconds: number;
  maxRetryCount: number;
  kmsMasterKeyId: string;
  kmsDataKeyReusePeriodSeconds: number;
  deadLetterMessageRetentionPeriodSeconds: number;
  enabled: boolean;
  fifo: boolean;
  visibilityTimeout: number;
  rawMessageDelivery: boolean;
  filterPolicy: any;

  mainQueueOverride: JsonObject;
  deadLetterQueueOverride: JsonObject;
  eventSourceMappingOverride: JsonObject;
  subscriptionOverride: JsonObject;
};

/**
 * Parse a value into a number or set it to a default value.
 *
 * @param {string|number|null|undefined} intString value possibly in string
 * @param {*} defaultInt the default value if `intString` can't be parsed
 */
const parseIntOr = (intString, defaultInt) => {
  if (intString === null || intString === undefined) {
    return defaultInt;
  }
  try {
    return parseInt(intString.toString(), 10);
  } catch {
    return defaultInt;
  }
};

/**
 * Converts a string from camelCase to PascalCase. Basically, it just
 * capitalises the first letter.
 *
 * @param {string} camelCase camelCase string
 */
const pascalCase = (camelCase: string): string =>
  camelCase.slice(0, 1).toUpperCase() + camelCase.slice(1);

const pascalCaseAllKeys = (jsonObject: JsonObject): JsonObject =>
  Object.keys(jsonObject).reduce(
    (acc, key) => ({
      ...acc,
      [pascalCase(key)]: jsonObject[key]
    }),
    {}
  );

/**
 * The ServerlessSnsSqsLambda plugin looks for functions that contain an
 * `snsSqs` event and adds the necessary resources for the Lambda to subscribe
 * to the SNS topics with error handling and retry functionality built in.
 *
 * An example configuration might look like:
 *
 *     functions:
 *       processEvent:
 *         handler: handler.handler
 *         events:
 *           - snsSqs:
 *             name: ResourcePrefix
 *             topicArn: ${self:custom.topicArn}
 *             batchSize: 2
 *             maximumBatchingWindowInSeconds: 30
 *             maxRetryCount: 2
 *             kmsMasterKeyId: alias/aws/sqs
 *             kmsDataKeyReusePeriodSeconds: 600
 *             deadLetterMessageRetentionPeriodSeconds: 1209600
 *             visibilityTimeout: 120
 *             rawMessageDelivery: true
 *             enabled: false
 *             fifo: false
 *             filterPolicy:
 *               pet:
 *                 - dog
 *                 - cat
 */
export default class ServerlessSnsSqsLambda {
  serverless: any;
  options: any;
  provider: any;
  custom: any;
  serviceName: string;
  hooks: any;

  /**
   * @param {*} serverless
   * @param {*} options
   */
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = serverless ? serverless.getProvider("aws") : null;
    this.custom = serverless.service ? serverless.service.custom : null;
    this.serviceName = serverless.service.service;

    serverless.configSchemaHandler.defineFunctionEvent("aws", "snsSqs", {
      type: "object",
      properties: {
        name: { type: "string" },
        topicArn: { $ref: "#/definitions/awsArn" },
        batchSize: { type: "number", minimum: 1, maximum: 10000 },
        maximumBatchingWindowInSeconds: {
          type: "number",
          minimum: 0,
          maximum: 300
        },
        maxRetryCount: { type: "number" },
        kmsMasterKeyId: {
          anyOf: [{ type: "string" }, { $ref: "#/definitions/awsArn" }]
        },
        kmsDataKeyReusePeriodSeconds: {
          type: "number",
          minimum: 60,
          maximum: 86400
        },
        visibilityTimeout: {
          type: "number",
          minimum: 0,
          maximum: 43200
        },
        deadLetterMessageRetentionPeriodSeconds: {
          type: "number",
          minimum: 60,
          maximum: 1209600
        },
        rawMessageDelivery: { type: "boolean" },
        enabled: { type: "boolean" },
        fifo: { type: "boolean" },
        filterPolicy: { type: "object" },
        mainQueueOverride: { type: "object" },
        deadLetterQueueOverride: { type: "object" },
        eventSourceMappingOverride: { type: "object" },
        subscriptionOverride: { type: "object" }
      },
      required: ["name", "topicArn"],
      additionalProperties: false
    });

    if (!this.provider) {
      throw new Error("This plugin must be used with AWS");
    }

    this.hooks = {
      "aws:package:finalize:mergeCustomProviderResources":
        this.modifyTemplate.bind(this)
    };
  }

  /**
   * Mutate the CloudFormation template, adding the necessary resources for
   * the Lambda to subscribe to the SNS topics with error handling and retry
   * functionality built in.
   */
  modifyTemplate() {
    const functions = this.serverless.service.functions;
    const stage = this.serverless.service.provider.stage;
    const template =
      this.serverless.service.provider.compiledCloudFormationTemplate;

    Object.keys(functions).forEach(funcKey => {
      const func = functions[funcKey];
      if (func.events) {
        func.events.forEach(event => {
          if (event.snsSqs) {
            if (this.options.verbose) {
              console.info(
                `Adding snsSqs event handler [${JSON.stringify(event.snsSqs)}]`
              );
            }
            this.addSnsSqsResources(template, funcKey, stage, event.snsSqs);
          }
        });
      }
    });
  }

  /**
   *
   * @param {object} template the template which gets mutated
   * @param {string} funcName the name of the function from serverless config
   * @param {string} stage the stage name from the serverless config
   * @param {object} snsSqsConfig the configuration values from the snsSqs
   *  event portion of the serverless function config
   */
  addSnsSqsResources(template, funcName, stage, snsSqsConfig) {
    const config = this.validateConfig(funcName, stage, snsSqsConfig);

    [
      this.addEventSourceMapping,
      this.addEventDeadLetterQueue,
      this.addEventQueue,
      this.addEventQueuePolicy,
      this.addTopicSubscription,
      this.addLambdaSqsPermissions
    ].reduce((template, func) => {
      func(template, config);
      return template;
    }, template);
  }

  /**
   * Validate the configuration values from the serverless config file,
   * returning a config object that can be passed to the resource setup
   * functions.
   *
   * @param {string} funcName the name of the function from serverless config
   * @param {string} stage the stage name from the serverless config
   * @param {object} config the configuration values from the snsSqs event
   *  portion of the serverless function config
   */
  validateConfig(funcName, stage, config): Config {
    if (!config.topicArn || !config.name) {
      throw new Error(`Error:
When creating an snsSqs handler, you must define the name and topicArn.
In function [${funcName}]:
- name was [${config.name}]
- topicArn was [${config.topicArn}].

Usage
-----

  functions:
    processEvent:
      handler: handler.handler
      events:
        - snsSqs:
            name: Event                                      # required
            topicArn: !Ref TopicArn                          # required
            prefix: some-prefix                              # optional - default is \`\${this.serviceName}-\${stage}-\${funcNamePascalCase}\`
            maxRetryCount: 2                                 # optional - default is 5
            batchSize: 1                                     # optional - default is 10
            batchWindow: 10                                  # optional - default is 0 (no batch window)
            kmsMasterKeyId: alias/aws/sqs                    # optional - default is none (no encryption)
            kmsDataKeyReusePeriodSeconds: 600                # optional - AWS default is 300 seconds
            deadLetterMessageRetentionPeriodSeconds: 1209600 # optional - AWS default is 345600 secs (4 days)
            enabled: true                                    # optional - AWS default is true
            fifo: false                                      # optional - AWS default is false
            visibilityTimeout: 30                            # optional - AWS default is 30 seconds
            rawMessageDelivery: false                        # optional - default is false
            filterPolicy:
              pet:
                - dog
                - cat

            # Overrides for generated CloudFormation templates
            # Mirrors the CloudFormation docs but uses camel case instead of title case
            #
            #
            # https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-sqs-queues.html
            mainQueueOverride:
              maximumMessageSize: 1024
              ...
            deadLetterQueueOverride:
              maximumMessageSize: 1024
              ...
            # https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-lambda-eventsourcemapping.html
            eventSourceMappingOverride:
              bisectBatchOnFunctionError: true
            # https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-sns-subscription.html
            subscriptionOverride:
              rawMessageDelivery: true

`);
    }

    const funcNamePascalCase = pascalCase(funcName);
    return {
      ...config,
      name: config.name,
      funcName: funcNamePascalCase,
      prefix:
        config.prefix || `${this.serviceName}-${stage}-${funcNamePascalCase}`,
      batchSize: parseIntOr(config.batchSize, 10),
      maxRetryCount: parseIntOr(config.maxRetryCount, 5),
      kmsMasterKeyId: config.kmsMasterKeyId,
      kmsDataKeyReusePeriodSeconds: config.kmsDataKeyReusePeriodSeconds,
      deadLetterMessageRetentionPeriodSeconds:
        config.deadLetterMessageRetentionPeriodSeconds,
      enabled: config.enabled,
      fifo: config.fifo !== undefined ? config.fifo : false,
      visibilityTimeout: config.visibilityTimeout,
      rawMessageDelivery:
        config.rawMessageDelivery !== undefined
          ? config.rawMessageDelivery
          : false,
      mainQueueOverride: config.mainQueueOverride ?? {},
      deadLetterQueueOverride: config.deadLetterQueueOverride ?? {},
      eventSourceMappingOverride: config.eventSourceMappingOverride ?? {},
      subscriptionOverride: config.subscriptionOverride ?? {}
    };
  }

  /**
   * Add the Event Source Mapping which sets up the message handler to pull
   * events of the Event Queue and handle them.
   *
   * @param {object} template the template which gets mutated
   * @param {{funcName, name, prefix, batchSize, enabled}} config including name of the queue
   *  and the resource prefix
   */
  addEventSourceMapping(
    template,
    {
      funcName,
      name,
      batchSize,
      maximumBatchingWindowInSeconds,
      enabled,
      eventSourceMappingOverride
    }: Config
  ) {
    const enabledWithDefault = enabled !== undefined ? enabled : true;
    template.Resources[`${funcName}EventSourceMappingSQS${name}Queue`] = {
      Type: "AWS::Lambda::EventSourceMapping",
      DependsOn: "IamRoleLambdaExecution",
      Properties: {
        BatchSize: batchSize,
        MaximumBatchingWindowInSeconds:
          maximumBatchingWindowInSeconds !== undefined
            ? maximumBatchingWindowInSeconds
            : 0,
        EventSourceArn: { "Fn::GetAtt": [`${name}Queue`, "Arn"] },
        FunctionName: { "Fn::GetAtt": [`${funcName}LambdaFunction`, "Arn"] },
        Enabled: enabledWithDefault ? "True" : "False",
        ...pascalCaseAllKeys(eventSourceMappingOverride)
      }
    };
  }

  /**
   * Add the Dead Letter Queue which will collect failed messages for later
   * inspection and handling.
   *
   * @param {object} template the template which gets mutated
   * @param {{name, prefix, kmsMasterKeyId, kmsDataKeyReusePeriodSeconds, deadLetterMessageRetentionPeriodSeconds }} config including name of the queue
   *  and the resource prefix
   */
  addEventDeadLetterQueue(
    template,
    {
      name,
      prefix,
      fifo,
      kmsMasterKeyId,
      kmsDataKeyReusePeriodSeconds,
      deadLetterMessageRetentionPeriodSeconds,
      deadLetterQueueOverride
    }
  ) {
    template.Resources[`${name}DeadLetterQueue`] = {
      Type: "AWS::SQS::Queue",
      Properties: {
        QueueName: `${prefix}${name}DeadLetterQueue${fifo ? '.fifo' : ''}`,
        ...(fifo ? { FifoQueue: true } : {}),
        ...(kmsMasterKeyId !== undefined
          ? {
              KmsMasterKeyId: kmsMasterKeyId
            }
          : {}),
        ...(kmsDataKeyReusePeriodSeconds !== undefined
          ? {
              KmsDataKeyReusePeriodSeconds: kmsDataKeyReusePeriodSeconds
            }
          : {}),
        ...(deadLetterMessageRetentionPeriodSeconds !== undefined
          ? {
              MessageRetentionPeriod: deadLetterMessageRetentionPeriodSeconds
            }
          : {}),
        ...pascalCaseAllKeys(deadLetterQueueOverride)
      }
    };
  }

  /**
   * Add the event queue that will subscribe to the topic and collect the events
   * from SNS as they arrive, holding them for processing.
   *
   * @param {object} template the template which gets mutated
   * @param {{name, prefix, maxRetryCount, kmsMasterKeyId, kmsDataKeyReusePeriodSeconds, visibilityTimeout}} config including name of the queue,
   *  the resource prefix and the max retry count for message handler failures.
   */
  addEventQueue(
    template,
    {
      name,
      prefix,
      fifo,
      maxRetryCount,
      kmsMasterKeyId,
      kmsDataKeyReusePeriodSeconds,
      visibilityTimeout,
      mainQueueOverride
    }: Config
  ) {
    template.Resources[`${name}Queue`] = {
      Type: "AWS::SQS::Queue",
      Properties: {
        QueueName: `${prefix}${name}Queue${fifo ? '.fifo' : ''}`,
        ...(fifo ? { FifoQueue: true } : {}),
        RedrivePolicy: {
          deadLetterTargetArn: {
            "Fn::GetAtt": [`${name}DeadLetterQueue`, "Arn"]
          },
          maxReceiveCount: maxRetryCount
        },
        ...(kmsMasterKeyId !== undefined
          ? {
              KmsMasterKeyId: kmsMasterKeyId
            }
          : {}),
        ...(kmsDataKeyReusePeriodSeconds !== undefined
          ? {
              KmsDataKeyReusePeriodSeconds: kmsDataKeyReusePeriodSeconds
            }
          : {}),
        ...(visibilityTimeout !== undefined
          ? {
              VisibilityTimeout: visibilityTimeout
            }
          : {}),
        ...pascalCaseAllKeys(mainQueueOverride)
      }
    };
  }

  /**
   * Add a policy allowing the queue to subscribe to the SNS topic.
   *
   * @param {object} template the template which gets mutated
   * @param {{name, prefix, topicArn}} config including name of the queue, the
   *  resource prefix and the arn of the topic
   */
  addEventQueuePolicy(template, { name, prefix, topicArn }: Config) {
    template.Resources[`${name}QueuePolicy`] = {
      Type: "AWS::SQS::QueuePolicy",
      Properties: {
        PolicyDocument: {
          Version: "2012-10-17",
          Id: `${prefix}${name}Queue`,
          Statement: [
            {
              Sid: `${prefix}${name}Sid`,
              Effect: "Allow",
              Principal: { Service: "sns.amazonaws.com" },
              Action: "SQS:SendMessage",
              Resource: { "Fn::GetAtt": [`${name}Queue`, "Arn"] },
              Condition: { ArnEquals: { "aws:SourceArn": [topicArn] } }
            }
          ]
        },
        Queues: [{ Ref: `${name}Queue` }]
      }
    };
  }

  /**
   * Subscribe the newly created queue to the desired topic.
   *
   * @param {object} template the template which gets mutated
   * @param {{name, topicArn, filterPolicy}} config including name of the queue,
   *  the arn of the topic and the filter policy for the subscription
   */
  addTopicSubscription(
    template,
    {
      name,
      topicArn,
      filterPolicy,
      rawMessageDelivery,
      subscriptionOverride
    }: Config
  ) {
    template.Resources[`Subscribe${name}Topic`] = {
      Type: "AWS::SNS::Subscription",
      Properties: {
        Endpoint: { "Fn::GetAtt": [`${name}Queue`, "Arn"] },
        Protocol: "sqs",
        TopicArn: topicArn,
        ...(filterPolicy ? { FilterPolicy: filterPolicy } : {}),
        ...(rawMessageDelivery !== undefined
          ? {
              RawMessageDelivery: rawMessageDelivery
            }
          : {}),
        ...pascalCaseAllKeys(subscriptionOverride)
      }
    };
  }

  /**
   * Add permissions so that the SQS handler can access the queue.
   *
   * @param {object} template the template which gets mutated
   * @param {{name, prefix}} config the name of the queue the lambda is subscribed to
   */
  addLambdaSqsPermissions(template, { name, prefix, fifo }) {
    template.Resources.IamRoleLambdaExecution.Properties.Policies[0].PolicyDocument.Statement.push(
      {
        Effect: "Allow",
        Action: [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ],
        Resource: [
          {
            "Fn::Sub": `arn:\${AWS::Partition}:sqs:\${AWS::Region}:\${AWS::AccountId}:${prefix}${name}Queue${fifo ? '.fifo' : ''}`
          },
          {
            "Fn::Sub": `arn:\${AWS::Partition}:sqs:\${AWS::Region}:\${AWS::AccountId}:${prefix}${name}DeadLetterQueue${fifo ? '.fifo' : ''}`
          }
        ]
      }
    );
  }
}
