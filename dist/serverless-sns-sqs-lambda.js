"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
// Future work: Properly type the file
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * A regular expression that matches AWS KMS arns
 */
var kmsArnRegex = /^arn:aws:kms:.*:.*:key\/.+$/;
/**
 * Parse a value into a number or set it to a default value.
 *
 * @param {string|number|null|undefined} intString value possibly in string
 * @param {*} defaultInt the default value if `intString` can't be parsed
 */
var parseIntOr = function (intString, defaultInt) {
    if (intString === null || intString === undefined) {
        return defaultInt;
    }
    try {
        return parseInt(intString.toString(), 10);
    }
    catch (_a) {
        return defaultInt;
    }
};
/**
 * Converts a string from camelCase to PascalCase. Basically, it just
 * capitalises the first letter.
 *
 * @param {string} camelCase camelCase string
 */
var pascalCase = function (camelCase) {
    return camelCase.slice(0, 1).toUpperCase() + camelCase.slice(1);
};
var pascalCaseAllKeys = function (jsonObject) {
    return Object.keys(jsonObject).reduce(function (acc, key) {
        var _a;
        return (__assign(__assign({}, acc), (_a = {}, _a[pascalCase(key)] = jsonObject[key], _a)));
    }, {});
};
var validateQueueName = function (queueName) {
    if (queueName.length > 80) {
        throw new Error("Generated queue name [" + queueName + "] is longer than 80 characters long and may be truncated by AWS, causing naming collisions. Try a shorter prefix or name, or try the hashQueueName config option.");
    }
    return queueName;
};
/**
 * Returns true if the provided string looks like an KMS ARN, otherwise false
 * @param possibleArn the candidate string
 * @returns true if the provided string looks like a KMS ARN, otherwise false
 */
var isKmsArn = function (possibleArn) {
    return kmsArnRegex.test(possibleArn);
};
/**
 * Adds a resource block to a template, ensuring uniqueness.
 * @param template the serverless template
 * @param logicalId the logical ID (resource key) for the resource
 * @param resourceDefinition the definition of the resource
 */
var addResource = function (template, logicalId, resourceDefinition) {
    if (logicalId in template.Resources) {
        throw new Error("Generated logical ID [" + logicalId + "] already exists in resources definition. Ensure that the snsSqs event definition has a unique name property.");
    }
    template.Resources[logicalId] = resourceDefinition;
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
 *             name: ResourcePrefix
 *             topicArn: ${self:custom.topicArn}
 *             batchSize: 2
 *             maximumBatchingWindowInSeconds: 30
 *             maxRetryCount: 2
 *             kmsMasterKeyId: alias/aws/sqs
 *             kmsDataKeyReusePeriodSeconds: 600
 *             deadLetterMessageRetentionPeriodSeconds: 1209600
 *             deadLetterQueueEnabled: true
 *             visibilityTimeout: 120
 *             rawMessageDelivery: true
 *             enabled: false
 *             fifo: false
 *             filterPolicy:
 *               pet:
 *                 - dog
 *                 - cat
 */
var ServerlessSnsSqsLambda = /** @class */ (function () {
    /**
     * @param {*} serverless
     * @param {*} options
     */
    function ServerlessSnsSqsLambda(serverless, options) {
        this.serverless = serverless;
        this.options = options;
        this.provider = serverless ? serverless.getProvider("aws") : null;
        this.custom = serverless.service ? serverless.service.custom : null;
        this.serviceName = serverless.service.service;
        // Aligns with AWS provider order of precedence: https://github.com/serverless/serverless/blob/46d090a302b9f7f4a3cf479695489b7ffc46b75b/lib/plugins/aws/provider.js#L1728
        // Serverless will set one of these to "dev" if it is not provided so we don't need an explicit fallback
        this.stage =
            this.options.stage ||
                this.serverless.config.stage ||
                this.serverless.service.provider.stage;
        serverless.configSchemaHandler.defineFunctionEvent("aws", "snsSqs", {
            type: "object",
            properties: {
                name: { type: "string" },
                topicArn: { $ref: "#/definitions/awsArn" },
                prefix: { type: "string" },
                omitPhysicalId: { type: "boolean" },
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
                deadLetterQueueEnabled: { type: "boolean" },
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
            "aws:package:finalize:mergeCustomProviderResources": this.modifyTemplate.bind(this)
        };
    }
    /**
     * Mutate the CloudFormation template, adding the necessary resources for
     * the Lambda to subscribe to the SNS topics with error handling and retry
     * functionality built in.
     */
    ServerlessSnsSqsLambda.prototype.modifyTemplate = function () {
        var _this = this;
        var functions = this.serverless.service.functions;
        var template = this.serverless.service.provider.compiledCloudFormationTemplate;
        Object.keys(functions).forEach(function (funcKey) {
            var func = functions[funcKey];
            if (func.events) {
                func.events.forEach(function (event) {
                    if (event.snsSqs) {
                        if (_this.options.verbose) {
                            console.info("Adding snsSqs event handler [" + JSON.stringify(event.snsSqs) + "]");
                        }
                        _this.addSnsSqsResources(template, funcKey, _this.stage, event.snsSqs);
                    }
                });
            }
        });
    };
    /**
     *
     * @param {object} template the template which gets mutated
     * @param {string} funcName the name of the function from serverless config
     * @param {string} stage the stage name from the serverless config
     * @param {object} snsSqsConfig the configuration values from the snsSqs
     *  event portion of the serverless function config
     */
    ServerlessSnsSqsLambda.prototype.addSnsSqsResources = function (template, funcName, stage, snsSqsConfig) {
        var config = this.validateConfig(funcName, stage, snsSqsConfig);
        [
            this.addEventSourceMapping,
            this.addEventDeadLetterQueue,
            this.addEventQueue,
            this.addEventQueuePolicy,
            this.addTopicSubscription,
            this.addLambdaSqsPermissions
        ].reduce(function (template, func) {
            func(template, config);
            return template;
        }, template);
    };
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
    ServerlessSnsSqsLambda.prototype.validateConfig = function (funcName, stage, config) {
        var _a, _b, _c, _d;
        if (!config.topicArn || !config.name) {
            throw new Error("Error:\nWhen creating an snsSqs handler, you must define the name and topicArn.\nIn function [" + funcName + "]:\n- name was [" + config.name + "]\n- topicArn was [" + config.topicArn + "].\n\nUsage\n-----\n\n  functions:\n    processEvent:\n      handler: handler.handler\n      events:\n        - snsSqs:\n            name: Event                                      # required\n            topicArn: !Ref TopicArn                          # required\n            prefix: some-prefix                              # optional - default is `${this.serviceName}-${stage}-${funcNamePascalCase}`\n            maxRetryCount: 2                                 # optional - default is 5\n            batchSize: 1                                     # optional - default is 10\n            batchWindow: 10                                  # optional - default is 0 (no batch window)\n            kmsMasterKeyId: alias/aws/sqs                    # optional - default is none (no encryption)\n            kmsDataKeyReusePeriodSeconds: 600                # optional - AWS default is 300 seconds\n            deadLetterMessageRetentionPeriodSeconds: 1209600 # optional - AWS default is 345600 secs (4 days)\n            deadLetterQueueEnabled: true                     # optional - default is enabled\n            enabled: true                                    # optional - AWS default is true\n            fifo: false                                      # optional - AWS default is false\n            visibilityTimeout: 30                            # optional - AWS default is 30 seconds\n            rawMessageDelivery: false                        # optional - default is false\n            filterPolicy:\n              pet:\n                - dog\n                - cat\n\n            # Overrides for generated CloudFormation templates\n            # Mirrors the CloudFormation docs but uses camel case instead of title case\n            #\n            #\n            # https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-sqs-queues.html\n            mainQueueOverride:\n              maximumMessageSize: 1024\n              ...\n            deadLetterQueueOverride:\n              maximumMessageSize: 1024\n              ...\n            # https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-lambda-eventsourcemapping.html\n            eventSourceMappingOverride:\n              bisectBatchOnFunctionError: true\n            # https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-sns-subscription.html\n            subscriptionOverride:\n              rawMessageDelivery: true\n\n");
        }
        var funcNamePascalCase = this.serverless.providers.aws.naming.getNormalizedFunctionName(funcName);
        return __assign(__assign({}, config), { name: config.name, funcName: funcNamePascalCase, prefix: config.prefix || this.serviceName + "-" + stage + "-" + funcNamePascalCase, batchSize: parseIntOr(config.batchSize, 10), maxRetryCount: parseIntOr(config.maxRetryCount, 5), kmsMasterKeyId: config.kmsMasterKeyId, kmsDataKeyReusePeriodSeconds: config.kmsDataKeyReusePeriodSeconds, deadLetterMessageRetentionPeriodSeconds: config.deadLetterMessageRetentionPeriodSeconds, deadLetterQueueEnabled: config.deadLetterQueueEnabled !== undefined
                ? config.deadLetterQueueEnabled
                : true, enabled: config.enabled, fifo: config.fifo !== undefined ? config.fifo : false, visibilityTimeout: config.visibilityTimeout, rawMessageDelivery: config.rawMessageDelivery !== undefined
                ? config.rawMessageDelivery
                : false, mainQueueOverride: (_a = config.mainQueueOverride) !== null && _a !== void 0 ? _a : {}, deadLetterQueueOverride: (_b = config.deadLetterQueueOverride) !== null && _b !== void 0 ? _b : {}, eventSourceMappingOverride: (_c = config.eventSourceMappingOverride) !== null && _c !== void 0 ? _c : {}, subscriptionOverride: (_d = config.subscriptionOverride) !== null && _d !== void 0 ? _d : {} });
    };
    /**
     * Add the Event Source Mapping which sets up the message handler to pull
     * events of the Event Queue and handle them.
     *
     * @param {object} template the template which gets mutated
     * @param {{funcName, name, prefix, batchSize, enabled}} config including name of the queue
     *  and the resource prefix
     */
    ServerlessSnsSqsLambda.prototype.addEventSourceMapping = function (template, _a) {
        var funcName = _a.funcName, name = _a.name, batchSize = _a.batchSize, maximumBatchingWindowInSeconds = _a.maximumBatchingWindowInSeconds, enabled = _a.enabled, eventSourceMappingOverride = _a.eventSourceMappingOverride;
        var enabledWithDefault = enabled !== undefined ? enabled : true;
        addResource(template, funcName + "EventSourceMappingSQS" + name + "Queue", {
            Type: "AWS::Lambda::EventSourceMapping",
            Properties: __assign({ BatchSize: batchSize, MaximumBatchingWindowInSeconds: maximumBatchingWindowInSeconds !== undefined
                    ? maximumBatchingWindowInSeconds
                    : 0, EventSourceArn: { "Fn::GetAtt": [name + "Queue", "Arn"] }, FunctionName: { "Fn::GetAtt": [funcName + "LambdaFunction", "Arn"] }, Enabled: enabledWithDefault ? "True" : "False" }, pascalCaseAllKeys(eventSourceMappingOverride))
        });
    };
    /**
     * Add the Dead Letter Queue which will collect failed messages for later
     * inspection and handling.
     *
     * @param {object} template the template which gets mutated
     * @param {{name, prefix, kmsMasterKeyId, kmsDataKeyReusePeriodSeconds, deadLetterMessageRetentionPeriodSeconds }} config including name of the queue
     *  and the resource prefix
     */
    ServerlessSnsSqsLambda.prototype.addEventDeadLetterQueue = function (template, _a) {
        var name = _a.name, prefix = _a.prefix, fifo = _a.fifo, kmsMasterKeyId = _a.kmsMasterKeyId, kmsDataKeyReusePeriodSeconds = _a.kmsDataKeyReusePeriodSeconds, deadLetterMessageRetentionPeriodSeconds = _a.deadLetterMessageRetentionPeriodSeconds, deadLetterQueueOverride = _a.deadLetterQueueOverride, deadLetterQueueEnabled = _a.deadLetterQueueEnabled, omitPhysicalId = _a.omitPhysicalId;
        if (!deadLetterQueueEnabled) {
            return;
        }
        var candidateQueueName = "" + prefix + name + "DeadLetterQueue" + (fifo ? ".fifo" : "");
        addResource(template, name + "DeadLetterQueue", {
            Type: "AWS::SQS::Queue",
            Properties: __assign(__assign(__assign(__assign(__assign(__assign({}, (omitPhysicalId
                ? {}
                : { QueueName: validateQueueName(candidateQueueName) })), (fifo ? { FifoQueue: true } : {})), (kmsMasterKeyId !== undefined
                ? {
                    KmsMasterKeyId: kmsMasterKeyId
                }
                : {})), (kmsDataKeyReusePeriodSeconds !== undefined
                ? {
                    KmsDataKeyReusePeriodSeconds: kmsDataKeyReusePeriodSeconds
                }
                : {})), (deadLetterMessageRetentionPeriodSeconds !== undefined
                ? {
                    MessageRetentionPeriod: deadLetterMessageRetentionPeriodSeconds
                }
                : {})), pascalCaseAllKeys(deadLetterQueueOverride))
        });
    };
    /**
     * Add the event queue that will subscribe to the topic and collect the events
     * from SNS as they arrive, holding them for processing.
     *
     * @param {object} template the template which gets mutated
     * @param {{name, prefix, maxRetryCount, kmsMasterKeyId, kmsDataKeyReusePeriodSeconds, visibilityTimeout}} config including name of the queue,
     *  the resource prefix and the max retry count for message handler failures.
     */
    ServerlessSnsSqsLambda.prototype.addEventQueue = function (template, _a) {
        var name = _a.name, prefix = _a.prefix, fifo = _a.fifo, maxRetryCount = _a.maxRetryCount, kmsMasterKeyId = _a.kmsMasterKeyId, kmsDataKeyReusePeriodSeconds = _a.kmsDataKeyReusePeriodSeconds, visibilityTimeout = _a.visibilityTimeout, mainQueueOverride = _a.mainQueueOverride, omitPhysicalId = _a.omitPhysicalId, deadLetterQueueEnabled = _a.deadLetterQueueEnabled;
        var candidateQueueName = "" + prefix + name + "Queue" + (fifo ? ".fifo" : "");
        addResource(template, name + "Queue", {
            Type: "AWS::SQS::Queue",
            Properties: __assign(__assign(__assign(__assign(__assign(__assign(__assign({}, (omitPhysicalId
                ? {}
                : { QueueName: validateQueueName(candidateQueueName) })), (fifo ? { FifoQueue: true } : {})), (deadLetterQueueEnabled
                ? {
                    RedrivePolicy: {
                        deadLetterTargetArn: {
                            "Fn::GetAtt": [name + "DeadLetterQueue", "Arn"]
                        },
                        maxReceiveCount: maxRetryCount
                    }
                }
                : {})), (kmsMasterKeyId !== undefined
                ? {
                    KmsMasterKeyId: kmsMasterKeyId
                }
                : {})), (kmsDataKeyReusePeriodSeconds !== undefined
                ? {
                    KmsDataKeyReusePeriodSeconds: kmsDataKeyReusePeriodSeconds
                }
                : {})), (visibilityTimeout !== undefined
                ? {
                    VisibilityTimeout: visibilityTimeout
                }
                : {})), pascalCaseAllKeys(mainQueueOverride))
        });
    };
    /**
     * Add a policy allowing the queue to subscribe to the SNS topic.
     *
     * @param {object} template the template which gets mutated
     * @param {{name, prefix, topicArn}} config including name of the queue, the
     *  resource prefix and the arn of the topic
     */
    ServerlessSnsSqsLambda.prototype.addEventQueuePolicy = function (template, _a) {
        var name = _a.name, prefix = _a.prefix, topicArn = _a.topicArn;
        addResource(template, name + "QueuePolicy", {
            Type: "AWS::SQS::QueuePolicy",
            Properties: {
                PolicyDocument: {
                    Version: "2012-10-17",
                    Id: "" + prefix + name + "Queue",
                    Statement: [
                        {
                            Sid: "" + prefix + name + "Sid",
                            Effect: "Allow",
                            Principal: { Service: "sns.amazonaws.com" },
                            Action: "SQS:SendMessage",
                            Resource: { "Fn::GetAtt": [name + "Queue", "Arn"] },
                            Condition: { ArnEquals: { "aws:SourceArn": [topicArn] } }
                        }
                    ]
                },
                Queues: [{ Ref: name + "Queue" }]
            }
        });
    };
    /**
     * Subscribe the newly created queue to the desired topic.
     *
     * @param {object} template the template which gets mutated
     * @param {{name, topicArn, filterPolicy}} config including name of the queue,
     *  the arn of the topic and the filter policy for the subscription
     */
    ServerlessSnsSqsLambda.prototype.addTopicSubscription = function (template, _a) {
        var name = _a.name, topicArn = _a.topicArn, filterPolicy = _a.filterPolicy, rawMessageDelivery = _a.rawMessageDelivery, subscriptionOverride = _a.subscriptionOverride;
        addResource(template, "Subscribe" + name + "Topic", {
            Type: "AWS::SNS::Subscription",
            Properties: __assign(__assign(__assign({ Endpoint: { "Fn::GetAtt": [name + "Queue", "Arn"] }, Protocol: "sqs", TopicArn: topicArn }, (filterPolicy ? { FilterPolicy: filterPolicy } : {})), (rawMessageDelivery !== undefined
                ? {
                    RawMessageDelivery: rawMessageDelivery
                }
                : {})), pascalCaseAllKeys(subscriptionOverride))
        });
    };
    /**
     * Add permissions so that the SQS handler can access the queue.
     *
     * @param {object} template the template which gets mutated
     * @param {{name, prefix}} config the name of the queue the lambda is subscribed to
     */
    ServerlessSnsSqsLambda.prototype.addLambdaSqsPermissions = function (template, _a) {
        var name = _a.name, kmsMasterKeyId = _a.kmsMasterKeyId, deadLetterQueueEnabled = _a.deadLetterQueueEnabled;
        if (template.Resources.IamRoleLambdaExecution === undefined) {
            // The user has set their own custom role ARN so the Serverless generated role is not generated
            // We can safely skip this step because the owner of the custom role ARN is responsible for setting
            // this the relevant policy to allow the lambda to access the queue.
            return;
        }
        var queues = [{ "Fn::GetAtt": [name + "Queue", "Arn"] }];
        if (deadLetterQueueEnabled) {
            queues.push({ "Fn::GetAtt": [name + "DeadLetterQueue", "Arn"] });
        }
        template.Resources.IamRoleLambdaExecution.Properties.Policies[0].PolicyDocument.Statement.push({
            Effect: "Allow",
            Action: [
                "sqs:ReceiveMessage",
                "sqs:DeleteMessage",
                "sqs:GetQueueAttributes"
            ],
            Resource: queues
        });
        if (kmsMasterKeyId !== undefined && kmsMasterKeyId !== null) {
            // TODO: Should we rename kmsMasterKeyId to make it clearer that it can accept an ARN?
            var resource = 
            // If the key ID is an object, it is most likely a "Ref" or "GetAtt" so we should pass it straight through so it gets resolved by CloudFormation
            // If an ARN is provided, pass it straight through too, because no processing is needed
            // Otherwise if it isn't either of those things, it is probably an ID, so we need to
            // transform it to an ARN to make the policy valid
            typeof kmsMasterKeyId === "object" || isKmsArn(kmsMasterKeyId)
                ? kmsMasterKeyId
                : "arn:aws:kms:::key/" + kmsMasterKeyId;
            template.Resources.IamRoleLambdaExecution.Properties.Policies[0].PolicyDocument.Statement.push({
                Effect: "Allow",
                Action: ["kms:Decrypt"],
                Resource: resource
            });
        }
    };
    return ServerlessSnsSqsLambda;
}());
exports.default = ServerlessSnsSqsLambda;
//# sourceMappingURL=serverless-sns-sqs-lambda.js.map