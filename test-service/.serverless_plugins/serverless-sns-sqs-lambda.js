"use strict";

module.exports = class ServerlessSnsSqsLambda {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = serverless ? serverless.getProvider("aws") : null;
    this.custom = serverless.service ? serverless.service.custom : null;

    if (!this.provider) {
      throw new Error("This plugin must be used with AWS");
    }

    this.hooks = {
      "aws:package:finalize:mergeCustomProviderResources": this.modifyTemplate.bind(
        this
      )
    };
  }

  modifyTemplate() {
    const functions = this.serverless.service.functions;
    const template = this.serverless.service.provider
      .compiledCloudFormationTemplate;

    Object.keys(functions).forEach(funcKey => {
      const func = functions[funcKey];
      if (func.events) {
        func.events.forEach(event => {
          if (event.snsSqs) {
            this.addSnsSqsEvent(template, funcKey, event.snsSqs);
          }
        });
      }
    });
    console.dir(template, { depth: null });
  }

  addSnsSqsEvent(template, funcName, serverlessConfig) {
    this.validateConfig(funcName, serverlessConfig);

    const funcNamePascalCase =
      funcName.slice(0, 1).toUpperCase() + funcName.slice(1);
    const config = {
      funcName: funcNamePascalCase,
      ...serverlessConfig
    };

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

  validateConfig(funcName, { name, topicArn }) {
    if (!name || !topicArn) {
      console.error(`
When creating an snsSqs handler, you must define both name and topicArn.
In function ${funcName} name was [${name}] and topicArn was [${topicArn}].

e.g.

  functions:
    processEvent:
      handler: handler.handler
      events:
        - snsSqs:
            name: Event
            topicArn: \${self:custom.topicArn}
`);
    }
  }

  addEventSourceMapping(template, { funcName, name }) {
    template.Resources[`${funcName}EventSourceMappingSQS${name}Queue`] = {
      Type: "AWS::Lambda::EventSourceMapping",
      DependsOn: "IamRoleLambdaExecution",
      Properties: {
        BatchSize: 10,
        EventSourceArn: { "Fn::GetAtt": [`${name}Queue`, "Arn"] },
        FunctionName: { "Fn::GetAtt": [`${funcName}LambdaFunction`, "Arn"] },
        Enabled: "True"
      }
    };
  }

  addEventDeadLetterQueue(template, { name, funcName }) {
    template.Resources[`${name}DeadLetterQueue`] = {
      Type: "AWS::SQS::Queue",
      Properties: { QueueName: `${funcName}${name}DeadLetterQueue` }
    };
  }

  addEventQueue(template, { name, funcName }) {
    template.Resources[`${name}Queue`] = {
      Type: "AWS::SQS::Queue",
      Properties: {
        QueueName: `${funcName}${name}Queue`,
        RedrivePolicy: {
          deadLetterTargetArn: {
            "Fn::GetAtt": [`${name}DeadLetterQueue`, "Arn"]
          },
          maxReceiveCount: 5
        }
      }
    };
  }

  addEventQueuePolicy(template, { name, funcName, topicArn }) {
    template.Resources[`${name}QueuePolicy`] = {
      Type: "AWS::SQS::QueuePolicy",
      Properties: {
        PolicyDocument: {
          Version: "2012-10-17",
          Id: `${funcName}${name}Queue`,
          Statement: [
            {
              Sid: `${funcName}${name}Sid`,
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
