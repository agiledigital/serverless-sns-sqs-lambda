"use strict";

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
const pascalCase = camelCase =>
  camelCase.slice(0, 1).toUpperCase() + camelCase.slice(1);

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
 *               name: Event
 *               topicArn: !Ref TopicArn
 *               maxRetryCount: 2                   # optional - default is 5
 *               batchSize: 1                       # optional - default is 10
 *               kmsMasterKeyId: alias/aws/sqs      # optional - default is none (no encryption)
 *               kmsDataKeyReusePeriodSeconds: 600  # optional - AWS default is 300 seconds
 *               filterPolicy:KmsMasterKeyId
 *                 pet:
 *                   - dog
 *                   - cat
 */
module.exports = class ServerlessSnsSqsLambda {
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

    if (!this.provider) {
      throw new Error("This plugin must be used with AWS");
    }

    this.hooks = {
      "aws:package:finalize:mergeCustomProviderResources": this.modifyTemplate.bind(
        this
      )
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
    const template = this.serverless.service.provider
      .compiledCloudFormationTemplate;

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
  validateConfig(funcName, stage, config) {
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
            name: Event                        # required
            topicArn: !Ref TopicArn            # required
            maxRetryCount: 2                   # optional - default is 5
            batchSize: 1                       # optional - default is 10
            kmsMasterKeyId: alias/aws/sqs      # optional - default is none (no encryption)
            kmsDataKeyReusePeriodSeconds: 600  # optional - AWS default is 300 seconds
            rawMessageDelivery: false          # optional - default is true
            filterPolicy:
              pet:
                - dog
                - cat
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
      rawMessageDelivery: config.rawMessageDelivery !== undefined ? config.rawMessageDelivery : true
    };
  }

  /**
   * Add the Event Source Mapping which sets up the message handler to pull
   * events of the Event Queue and handle them.
   *
   * @param {object} template the template which gets mutated
   * @param {{funcName, name, prefix, batchSize}} config including name of the queue
   *  and the resource prefix
   */
  addEventSourceMapping(template, { funcName, name, batchSize }) {
    template.Resources[`${funcName}EventSourceMappingSQS${name}Queue`] = {
      Type: "AWS::Lambda::EventSourceMapping",
      DependsOn: "IamRoleLambdaExecution",
      Properties: {
        BatchSize: batchSize,
        EventSourceArn: { "Fn::GetAtt": [`${name}Queue`, "Arn"] },
        FunctionName: { "Fn::GetAtt": [`${funcName}LambdaFunction`, "Arn"] },
        Enabled: "True"
      }
    };
  }

  /**
   * Add the Dead Letter Queue which will collect failed messages for later
   * inspection and handling.
   *
   * @param {object} template the template which gets mutated
   * @param {{name, prefix, kmsMasterKeyId, kmsDataKeyReusePeriodSeconds }} config including name of the queue
   *  and the resource prefix
   */
  addEventDeadLetterQueue(template, { name, prefix, kmsMasterKeyId, kmsDataKeyReusePeriodSeconds }) {
    template.Resources[`${name}DeadLetterQueue`] = {
      Type: "AWS::SQS::Queue",
      Properties: {
        QueueName: `${prefix}${name}DeadLetterQueue`,
        ...(kmsMasterKeyId !== undefined ? {
          KmsMasterKeyId: kmsMasterKeyId,
        } : {}),
        ...(kmsDataKeyReusePeriodSeconds !== undefined ? {
          KmsDataKeyReusePeriodSeconds: kmsDataKeyReusePeriodSeconds,
        } : {}),
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
  addEventQueue(template, { name, prefix, maxRetryCount, kmsMasterKeyId, kmsDataKeyReusePeriodSeconds, visibilityTimeout }) {
    template.Resources[`${name}Queue`] = {
      Type: "AWS::SQS::Queue",
      Properties: {
        QueueName: `${prefix}${name}Queue`,
        RedrivePolicy: {
          deadLetterTargetArn: {
            "Fn::GetAtt": [`${name}DeadLetterQueue`, "Arn"]
          },
          maxReceiveCount: maxRetryCount
        },
        ...(kmsMasterKeyId !== undefined ? {
          KmsMasterKeyId: kmsMasterKeyId,
        } : {}),
        ... (kmsDataKeyReusePeriodSeconds !== undefined ? {
          KmsDataKeyReusePeriodSeconds: kmsDataKeyReusePeriodSeconds,
        } : {}),
        VisibilityTimeout: visibilityTimeout
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
  addEventQueuePolicy(template, { name, prefix, topicArn }) {
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
              Principal: { AWS: "*" },
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
  addTopicSubscription(template, { name, topicArn, filterPolicy, rawMessageDelivery }) {
    template.Resources[`Subscribe${name}Topic`] = {
      Type: "AWS::SNS::Subscription",
      Properties: {
        Endpoint: { "Fn::GetAtt": [`${name}Queue`, "Arn"] },
        Protocol: "sqs",
        TopicArn: topicArn,
        RawMessageDelivery: rawMessageDelivery,
        ...(filterPolicy ? { FilterPolicy: filterPolicy } : {})
      }
    };
  }

  /**
   * Add permissions so that the SQS handler can access the queue.
   *
   * @param {object} template the template which gets mutated
   * @param {{name, prefix}} config the name of the queue the lambda is subscribed to
   */
  addLambdaSqsPermissions(template, { name, prefix }) {
    template.Resources.IamRoleLambdaExecution.Properties.Policies[0].PolicyDocument.Statement.push(
      {
        Effect: "Allow",
        Action: [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ],
        Resource: [
          `arn:aws:sqs:#{AWS::Region}:#{AWS::AccountId}:${prefix}${name}Queue`,
          `arn:aws:sqs:#{AWS::Region}:#{AWS::AccountId}:${prefix}${name}DeadLetterQueue`
        ]
      }
    );
  }
};
