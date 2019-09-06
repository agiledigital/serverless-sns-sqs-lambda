# Serverless Sns Sqs Lambda

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com) [![MIT License](http://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENSE)

This is the Serverless Framework plugin for AWS lambda Functions.

# Table of Contents

- [Install](#install)
- [Setup](#setup)

## Install

Run `npm install` in your Serverless project.

`$ npm install --save-dev serverless-sns-sqs-lambda`

Add the plugin to your serverless.yml file

```yml
plugins:
  - serverless-sns-sqs-lambda
```

## Setup

Provide the lambda function with the snsSqs event, the plugin will add the AWS SNS topic and subscription, SQS queue and dead letter queue, and the role need for the lambda.

```yml
custom:
  topicArn: !Ref Topic

functions:
  processEvent:
    handler: handler.handler
    events:
      - snsSqs:
          name: TestEvent
          topicArn: ${self:custom.topicArn}

resources:
  Resources:
    Topic:
      Type: AWS::SNS::Topic
      Properties:
        TopicName: TestTopic

plugins:
  - serverless-sns-sqs-lambda
```
