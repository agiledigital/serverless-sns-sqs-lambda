# Serverless Sns Sqs Lambda

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![MIT License](http://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENSE) 
![Github Actions Status](https://github.com/agiledigital/serverless-sns-sqs-lambda/workflows/Node.js%20CI/badge.svg?branch=master)
[![Type Coverage](https://img.shields.io/badge/dynamic/json.svg?label=type-coverage&prefix=%E2%89%A5&suffix=%&query=$.typeCoverage.atLeast&uri=https%3A%2F%2Fraw.githubusercontent.com%2Fagiledigital%2Fserverless-sns-sqs-lambda%2Fmaster%2Fpackage.json)](https://github.com/plantain-00/type-coverage)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/agiledigital/serverless-sns-sqs-lambda.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/agiledigital/serverless-sns-sqs-lambda/context:javascript)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
![npm](https://img.shields.io/npm/v/@agiledigital/serverless-sns-sqs-lambda)


This is a Serverless Framework plugin for AWS lambda Functions. Currently, it
is possible to subscribe directly to an SNS topic. However, if you want to
provide retry capability and error handling, you need to write a whole lot of
boilerplate to add a Queue and a Dead Letter Queue between the Lambda and the
SNS topic. This plugin allows you to define an sns subscriber with a `batchSize`
and a `maxRetryCount` as simply as subscribing directly to the sns topic.

![Plugin Architecture](./plant-uml-files/plugin-arch.png?raw=true "Plugin Architecture")

# Table of Contents

- [Install](#install)
- [Setup](#setup)

## Install

Run `npm install` in your Serverless project.

`$ npm install --save-dev @agiledigital/serverless-sns-sqs-lambda`

Add the plugin to your serverless.yml file

```yml
plugins:
  - "@agiledigital/serverless-sns-sqs-lambda"
```

## Setup

Provide the lambda function with the snsSqs event, the plugin will add the AWS SNS topic and subscription, SQS queue and dead letter queue, and the role need for the lambda.

```yml
functions:
  processEvent:
    handler: handler.handler
    events:
      - snsSqs:
          name: TestEvent # Required - choose a name prefix for the event queue
          topicArn: !Ref Topic # Required - SNS topic to subscribe to
          batchSize: 2 # Optional - default value is 10
          maxRetryCount: 2 # Optional - default value is 5
          kmsMasterKeyId: alias/aws/sqs # optional - default is none (no encryption)
          kmsDataKeyReusePeriodSeconds: 600  # optional - AWS default is 300 seconds
          rawMessageDelivery: true # Optional - default value is true
          filterPolicy: # Optional - filter messages that are handled
            pets:
              - dog
              - cat

resources:
  Resources:
    Topic:
      Type: AWS::SNS::Topic
      Properties:
        TopicName: TestTopic

plugins:
  - '@agiledigital/serverless-sns-sqs-lambda'
```
