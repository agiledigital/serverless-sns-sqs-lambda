# Serverless Sns Sqs Lambda

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com) [![MIT License](http://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENSE) [![CircleCI](https://circleci.com/gh/agiledigital/serverless-sns-sqs-lambda.svg?style=svg)](https://circleci.com/gh/agiledigital/serverless-sns-sqs-lambda) [![Build Status](https://travis-ci.com/agiledigital/serverless-sns-sqs-lambda.svg?branch=master)](https://travis-ci.com/agiledigital/serverless-sns-sqs-lambda)

This is a Serverless Framework plugin for AWS lambda Functions. Currently, it
is possible to subsribe directly to an SNS topic. However, if you want to
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

`$ npm install --save-dev serverless-sns-sqs-lambda`

Add the plugin to your serverless.yml file

```yml
plugins:
  - serverless-sns-sqs-lambda
```

## Setup

Provide the lambda function with the snsSqs event, the plugin will add the AWS SNS topic and subscription, SQS queue and dead letter queue, and the role need for the lambda.

```yml
functions:
  processEvent:
    handler: handler.handler
    events:
      - snsSqs:
          name: TestEvent # Optional - choose a name for the event queue
          topicArn: !Ref Topic # Required - SNS topic to subscribe to
          batchSize: 2 # Optional - default value is 10
          maxRetryCount: 2 # Optional - default value is 5
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
  - serverless-sns-sqs-lambda
```
