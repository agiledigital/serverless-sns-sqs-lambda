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
    return parseInt(intString, 10);
  } catch {
    return defaultInt;
  }
};

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
 *               topicArn: \${self:custom.topicArn}
 *               maxRetryCount: 2 # optional - default is 5
 *               batchSize: 1     # optional - default is 10
 */
module.exports = class ServerlessSnsSqsLambda {
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
            this.addSnsSqsResources(template, funcKey, stage, event.snsSqs);
          }
        });
      }
    });
    console.dir(template, { depth: null });
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
    if (!config.name || !config.topicArn) {
      throw new Error(`Error:
When creating an snsSqs handler, you must define both name and topicArn.
In function ${funcName} name was [${config.name}] and topicArn was [${config.topicArn}].

e.g.

  functions:
    processEvent:
      handler: handler.handler
      events:
        - snsSqs:
            name: Event
            topicArn: \${self:custom.topicArn}
            maxRetryCount: 2 # optional - default is 5
            batchSize: 1     # optional - default is 10
`);
    }

    const funcNamePascalCase =
      funcName.slice(0, 1).toUpperCase() + funcName.slice(1);

    return {
      ...config,
      funcName: funcNamePascalCase,
      prefix:
        config.prefix || `${this.serviceName}-${stage}-${funcNamePascalCase}`,
      batchSize: parseIntOr(config.batchSize, 10),
      maxRetryCount: parseIntOr(config.maxRetryCount, 5)
    };
  }

  /**
   * Add the Event Source Mapping which sets up the message handler to pull
   * events of the Event Queue and handle them.
   *
   * @param {object} template the template which gets mutated
   * @param {{name, prefix, batchSize}} config including name of the queue
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
   * @param {{name, prefix}} config including name of the queue
   *  and the resource prefix
   */
  addEventDeadLetterQueue(template, { name, prefix }) {
    template.Resources[`${name}DeadLetterQueue`] = {
      Type: "AWS::SQS::Queue",
      Properties: { QueueName: `${prefix}${name}DeadLetterQueue` }
    };
  }

  /**
   * Add the event queue that will subscribe to the topic and collect the events
   * from SNS as they arrive, holding them for processing.
   *
   * @param {object} template the template which gets mutated
   * @param {{name, prefix, maxRetryCount}} config including name of the queue,
   *  the resource prefix and the max retry count for message handler failures.
   */
  addEventQueue(template, { name, prefix, maxRetryCount }) {
    template.Resources[`${name}Queue`] = {
      Type: "AWS::SQS::Queue",
      Properties: {
        QueueName: `${prefix}${name}Queue`,
        RedrivePolicy: {
          deadLetterTargetArn: {
            "Fn::GetAtt": [`${name}DeadLetterQueue`, "Arn"]
          },
          maxReceiveCount: maxRetryCount
        }
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
   * @param {{name, topicArn}} config including name of the queue and the arn
   *  of the topic
   */
  addTopicSubscription(template, { name, topicArn }) {
    template.Resources[`Subscribe${name}Topic`] = {
      Type: "AWS::SNS::Subscription",
      Properties: {
        Endpoint: { "Fn::GetAtt": [`${name}Queue`, "Arn"] },
        Protocol: "sqs",
        TopicArn: topicArn
      }
    };
  }

  /**
   * Add permissions so that the SQS handler can access the queue.
   *
   * @param {object} template the template which gets mutated
   * @param {{name}} config the name of the queue the lambda is subscribed to
   */
  addLambdaSqsPermissions(template, { name }) {
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
            "Fn::GetAtt": [`${name}Queue`, "Arn"]
          }
        ]
      }
    );
  }
};
