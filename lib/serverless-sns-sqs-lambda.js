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
  }

  addSnsSqsEvent(template, funcName, options) {
    const funcNamePascalCase =
      funcName.slice(0, 1).toUpperCase() + funcName.slice(1);
    options = {
      funcName: funcNamePascalCase,
      ...options
    };

    this.addEventSourceMapping(template, options);
    this.addEventDeadLetterQueue(template, options);
    this.addEventQueue(template, options);
    this.addEventQueuePolicy(template, options);
    this.addTopicSubscription(template, options);
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
};
