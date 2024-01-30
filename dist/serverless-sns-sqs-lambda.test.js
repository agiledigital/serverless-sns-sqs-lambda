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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var cli_1 = __importDefault(require("serverless/lib/classes/cli"));
var serverless_1 = __importDefault(require("serverless/lib/serverless"));
var provider_1 = __importDefault(require("serverless/lib/plugins/aws/provider"));
var serverless_sns_sqs_lambda_1 = __importDefault(require("./serverless-sns-sqs-lambda"));
// See https://github.com/serverless/test/blob/71746cd0e0c897de50e19bc96a3968e5f26bee4f/docs/run-serverless.md for more info on run-serverless
var run_serverless_1 = __importDefault(require("@serverless/test/run-serverless"));
var path_1 = require("path");
var serverlessPath = path_1.join(__dirname, "../node_modules/serverless");
var slsOpt = {
    region: "ap-southeast-2"
};
/**
 * Returns a resource that looks like what Serverless generates when not using
 * a custom execution role ARN.
 *
 * It would be better to get Serverless to generate this for us but we don't
 * run in a serverless context at the moment so this is the best we have.
 */
var generateIamLambdaExecutionRole = function () { return ({
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
}); };
describe("Test Serverless SNS SQS Lambda", function () {
    var serverless;
    var serverlessSnsSqsLambda;
    afterEach(function () {
        jest.resetModules(); // reset modules after each test
    });
    describe("when the provider is specified via a command line option", function () {
        var baseConfig = {
            service: "test-service",
            configValidationMode: "error",
            frameworkVersion: "*",
            provider: __assign(__assign({}, slsOpt), { name: "aws", runtime: "nodejs14.x", stage: "dev-test" }),
            package: {
                // This is simply here to prevent serverless from trying to package
                // any files. Since the config is generated in unique temp directories
                // for each test, there are no files to resolve for packaging
                // so providing a "pre-built" artefact with an absolute path
                // keeps serverless happy
                artifact: require.resolve("./__fixtures__/handler.js")
            },
            plugins: [require.resolve("../dist")]
        };
        it("should fail if name is not passed", function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        expect.assertions(1);
                        return [4 /*yield*/, expect(function () {
                                return run_serverless_1.default(serverlessPath, {
                                    command: "package",
                                    config: __assign(__assign({}, baseConfig), { functions: {
                                            processEvent: {
                                                handler: "handler.handler",
                                                events: [
                                                    {
                                                        snsSqs: {
                                                            topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic",
                                                            name: undefined
                                                        }
                                                    }
                                                ]
                                            }
                                        } })
                                });
                            }).rejects.toMatchInlineSnapshot("\n              [ServerlessError: Configuration error at 'functions.processEvent.events.0.snsSqs': must have required property 'name'\n\n              Learn more about configuration validation here: http://slss.io/configuration-validation]\n            ")];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("should fail if topicArn is not passed", function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        expect.assertions(1);
                        return [4 /*yield*/, expect(function () {
                                return run_serverless_1.default(serverlessPath, {
                                    command: "package",
                                    config: __assign(__assign({}, baseConfig), { functions: {
                                            processEvent: {
                                                handler: "handler.handler",
                                                events: [
                                                    {
                                                        snsSqs: {
                                                            topicArn: undefined,
                                                            name: "some name"
                                                        }
                                                    }
                                                ]
                                            }
                                        } })
                                });
                            }).rejects.toMatchInlineSnapshot("\n              [ServerlessError: Configuration error at 'functions.processEvent.events.0.snsSqs': must have required property 'topicArn'\n\n              Learn more about configuration validation here: http://slss.io/configuration-validation]\n            ")];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("should fail if topicArn is invalid", function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        expect.assertions(1);
                        return [4 /*yield*/, expect(function () {
                                return run_serverless_1.default(serverlessPath, {
                                    command: "package",
                                    config: __assign(__assign({}, baseConfig), { functions: {
                                            processEvent: {
                                                handler: "handler.handler",
                                                events: [
                                                    {
                                                        snsSqs: {
                                                            topicArn: "not_an_arn",
                                                            name: "some name"
                                                        }
                                                    }
                                                ]
                                            }
                                        } })
                                });
                            }).rejects.toMatchInlineSnapshot("\n              [ServerlessError: Configuration error at 'functions.processEvent.events.0.snsSqs.topicArn': unsupported string format\n\n              Learn more about configuration validation here: http://slss.io/configuration-validation]\n            ")];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        describe("when no optional parameters are provided", function () {
            it("should produce valid SQS CF template items", function () { return __awaiter(void 0, void 0, void 0, function () {
                var cfTemplate;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, run_serverless_1.default(serverlessPath, {
                                command: "package",
                                config: __assign(__assign({}, baseConfig), { functions: (_a = {},
                                        _a["test-function"] = {
                                            handler: "handler.handler",
                                            events: [
                                                {
                                                    snsSqs: {
                                                        name: "some-name",
                                                        topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic"
                                                    }
                                                }
                                            ]
                                        },
                                        _a) })
                            })];
                        case 1:
                            cfTemplate = (_b.sent()).cfTemplate;
                            expect(cfTemplate).toMatchSnapshot({
                                Resources: {
                                    TestDashfunctionLambdaFunction: {
                                        Properties: {
                                            Code: { S3Key: expect.any(String) }
                                        }
                                    }
                                }
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe("when all parameters are provided", function () {
            it("should produce valid SQS CF template items", function () { return __awaiter(void 0, void 0, void 0, function () {
                var cfTemplate;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, run_serverless_1.default(serverlessPath, {
                                command: "package",
                                config: __assign(__assign({}, baseConfig), { functions: (_a = {},
                                        _a["test-function"] = {
                                            handler: "handler.handler",
                                            events: [
                                                {
                                                    snsSqs: {
                                                        name: "some-name",
                                                        topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic",
                                                        batchSize: 7,
                                                        maximumBatchingWindowInSeconds: 99,
                                                        prefix: "some prefix",
                                                        maxRetryCount: 4,
                                                        kmsMasterKeyId: "some key",
                                                        kmsDataKeyReusePeriodSeconds: 200,
                                                        deadLetterMessageRetentionPeriodSeconds: 1209600,
                                                        deadLetterQueueEnabled: true,
                                                        enabled: false,
                                                        visibilityTimeout: 999,
                                                        rawMessageDelivery: true,
                                                        filterPolicy: { pet: ["dog", "cat"] }
                                                    }
                                                }
                                            ]
                                        },
                                        _a) })
                            })];
                        case 1:
                            cfTemplate = (_b.sent()).cfTemplate;
                            expect(cfTemplate).toMatchSnapshot({
                                Resources: {
                                    TestDashfunctionLambdaFunction: {
                                        Properties: {
                                            Code: { S3Key: expect.any(String) }
                                        }
                                    }
                                }
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe("when dead letter queue is disabled", function () {
            it("should not produce SQS dead letter queue and related IAM policies in CF template", function () { return __awaiter(void 0, void 0, void 0, function () {
                var cfTemplate;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, run_serverless_1.default(serverlessPath, {
                                command: "package",
                                config: __assign(__assign({}, baseConfig), { functions: (_a = {},
                                        _a["test-function"] = {
                                            handler: "handler.handler",
                                            events: [
                                                {
                                                    snsSqs: {
                                                        name: "some-name",
                                                        topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic",
                                                        deadLetterQueueEnabled: false
                                                    }
                                                }
                                            ]
                                        },
                                        _a) })
                            })];
                        case 1:
                            cfTemplate = (_b.sent()).cfTemplate;
                            expect(cfTemplate).toMatchSnapshot({
                                Resources: {
                                    TestDashfunctionLambdaFunction: {
                                        Properties: {
                                            Code: { S3Key: expect.any(String) }
                                        }
                                    }
                                }
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe("when encryption parameters are not provided", function () {
            it("should produce valid SQS CF template items", function () { return __awaiter(void 0, void 0, void 0, function () {
                var cfTemplate;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, run_serverless_1.default(serverlessPath, {
                                command: "package",
                                config: __assign(__assign({}, baseConfig), { functions: (_a = {},
                                        _a["test-function"] = {
                                            handler: "handler.handler",
                                            events: [
                                                {
                                                    snsSqs: {
                                                        name: "some-name",
                                                        topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic",
                                                        prefix: "some prefix",
                                                        maxRetryCount: 4
                                                    }
                                                }
                                            ]
                                        },
                                        _a) })
                            })];
                        case 1:
                            cfTemplate = (_b.sent()).cfTemplate;
                            expect(cfTemplate).toMatchSnapshot({
                                Resources: {
                                    TestDashfunctionLambdaFunction: {
                                        Properties: {
                                            Code: { S3Key: expect.any(String) }
                                        }
                                    }
                                }
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe("when overriding the generated CloudFormation template", function () {
            it("the overrides should take precedence", function () { return __awaiter(void 0, void 0, void 0, function () {
                var cfTemplate;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, run_serverless_1.default(serverlessPath, {
                                command: "package",
                                config: __assign(__assign({}, baseConfig), { functions: (_a = {},
                                        _a["test-function"] = {
                                            handler: "handler.handler",
                                            events: [
                                                {
                                                    snsSqs: {
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
                                                    }
                                                }
                                            ]
                                        },
                                        _a) })
                            })];
                        case 1:
                            cfTemplate = (_b.sent()).cfTemplate;
                            expect(cfTemplate).toMatchSnapshot({
                                Resources: {
                                    TestDashfunctionLambdaFunction: {
                                        Properties: {
                                            Code: { S3Key: expect.any(String) }
                                        }
                                    }
                                }
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe("when fifo is true", function () {
            it("should produce valid fifo queues", function () { return __awaiter(void 0, void 0, void 0, function () {
                var cfTemplate;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, run_serverless_1.default(serverlessPath, {
                                command: "package",
                                config: __assign(__assign({}, baseConfig), { functions: (_a = {},
                                        _a["test-function"] = {
                                            handler: "handler.handler",
                                            events: [
                                                {
                                                    snsSqs: {
                                                        name: "some-name",
                                                        topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic",
                                                        fifo: true
                                                    }
                                                }
                                            ]
                                        },
                                        _a) })
                            })];
                        case 1:
                            cfTemplate = (_b.sent()).cfTemplate;
                            expect(cfTemplate).toMatchSnapshot({
                                Resources: {
                                    TestDashfunctionLambdaFunction: {
                                        Properties: {
                                            Code: { S3Key: expect.any(String) }
                                        }
                                    }
                                }
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe("when a custom role ARN is specified", function () {
            it("it should not crash and just skip creating the policies", function () { return __awaiter(void 0, void 0, void 0, function () {
                var cfTemplate;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, run_serverless_1.default(serverlessPath, {
                                command: "package",
                                config: __assign(__assign({}, baseConfig), { provider: __assign(__assign({}, baseConfig.provider), { iam: {
                                            role: "arn:aws:iam::123456789012:role/execution-role",
                                            deploymentRole: "arn:aws:iam::123456789012:role/deploy-role"
                                        } }), functions: (_a = {},
                                        _a["test-function"] = {
                                            handler: "handler.handler",
                                            events: [
                                                {
                                                    snsSqs: {
                                                        name: "some-name",
                                                        topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic"
                                                    }
                                                }
                                            ]
                                        },
                                        _a) })
                            })];
                        case 1:
                            cfTemplate = (_b.sent()).cfTemplate;
                            expect(cfTemplate).toMatchSnapshot({
                                Resources: {
                                    TestDashfunctionLambdaFunction: {
                                        Properties: {
                                            Code: { S3Key: expect.any(String) }
                                        }
                                    }
                                }
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe("when the provider is specified via a config option in serverless.yml", function () {
        beforeEach(function () {
            serverless = new serverless_1.default({ commands: [], options: {} });
            serverless.service.service = "test-service";
            // This should really be a proper instance of the Config class. See also: https://github.com/agiledigital/serverless-sns-sqs-lambda/issues/313
            serverless.config = { stage: "dev-test-config" };
            var options = __assign({}, slsOpt);
            var provider = new provider_1.default(serverless);
            serverless.setProvider("aws", provider);
            serverless.cli = new cli_1.default(serverless);
            serverlessSnsSqsLambda = new serverless_sns_sqs_lambda_1.default(serverless, options);
        });
        describe("when no optional parameters are provided", function () {
            it("should produce valid SQS CF template items", function () {
                var template = {
                    Resources: __assign({}, generateIamLambdaExecutionRole())
                };
                var testConfig = {
                    name: "some-name",
                    topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic"
                };
                var validatedConfig = serverlessSnsSqsLambda.validateConfig("test-function", serverlessSnsSqsLambda.stage, testConfig);
                serverlessSnsSqsLambda.addEventQueue(template, validatedConfig);
                serverlessSnsSqsLambda.addEventDeadLetterQueue(template, validatedConfig);
                serverlessSnsSqsLambda.addEventSourceMapping(template, validatedConfig);
                serverlessSnsSqsLambda.addTopicSubscription(template, validatedConfig);
                serverlessSnsSqsLambda.addLambdaSqsPermissions(template, validatedConfig);
                expect(template).toMatchSnapshot();
            });
        });
        describe("when fifo is true", function () {
            it("should produce valid fifo queues", function () {
                var template = {
                    Resources: __assign({}, generateIamLambdaExecutionRole())
                };
                var testConfig = {
                    name: "some-name",
                    topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic",
                    fifo: true
                };
                var validatedConfig = serverlessSnsSqsLambda.validateConfig("test-function", serverlessSnsSqsLambda.stage, testConfig);
                serverlessSnsSqsLambda.addEventQueue(template, validatedConfig);
                serverlessSnsSqsLambda.addEventDeadLetterQueue(template, validatedConfig);
                serverlessSnsSqsLambda.addEventSourceMapping(template, validatedConfig);
                serverlessSnsSqsLambda.addTopicSubscription(template, validatedConfig);
                serverlessSnsSqsLambda.addLambdaSqsPermissions(template, validatedConfig);
                expect(template).toMatchSnapshot();
            });
        });
    });
    describe("when the provider is specified via a provider option in serverless.yml", function () {
        beforeEach(function () {
            serverless = new serverless_1.default({ commands: [], options: {} });
            serverless.service.service = "test-service";
            var options = __assign({}, slsOpt);
            var provider = new provider_1.default(serverless);
            serverless.setProvider("aws", provider);
            serverless.service.provider.stage = "dev-test-provider";
            serverless.cli = new cli_1.default(serverless);
            serverlessSnsSqsLambda = new serverless_sns_sqs_lambda_1.default(serverless, options);
        });
        describe("when no optional parameters are provided", function () {
            it("should produce valid SQS CF template items", function () {
                var template = {
                    Resources: __assign({}, generateIamLambdaExecutionRole())
                };
                var testConfig = {
                    name: "some-name",
                    topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic"
                };
                var validatedConfig = serverlessSnsSqsLambda.validateConfig("test-function", serverlessSnsSqsLambda.stage, testConfig);
                serverlessSnsSqsLambda.addEventQueue(template, validatedConfig);
                serverlessSnsSqsLambda.addEventDeadLetterQueue(template, validatedConfig);
                serverlessSnsSqsLambda.addEventSourceMapping(template, validatedConfig);
                serverlessSnsSqsLambda.addTopicSubscription(template, validatedConfig);
                serverlessSnsSqsLambda.addLambdaSqsPermissions(template, validatedConfig);
                expect(template).toMatchSnapshot();
            });
        });
        describe("when fifo is true", function () {
            it("should produce valid fifo queues", function () {
                var template = {
                    Resources: __assign({}, generateIamLambdaExecutionRole())
                };
                var testConfig = {
                    name: "some-name",
                    topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic",
                    fifo: true
                };
                var validatedConfig = serverlessSnsSqsLambda.validateConfig("test-function", serverlessSnsSqsLambda.stage, testConfig);
                serverlessSnsSqsLambda.addEventQueue(template, validatedConfig);
                serverlessSnsSqsLambda.addEventDeadLetterQueue(template, validatedConfig);
                serverlessSnsSqsLambda.addEventSourceMapping(template, validatedConfig);
                serverlessSnsSqsLambda.addTopicSubscription(template, validatedConfig);
                serverlessSnsSqsLambda.addLambdaSqsPermissions(template, validatedConfig);
                expect(template).toMatchSnapshot();
            });
        });
    });
    describe("when no provider is specified", function () {
        beforeEach(function () {
            serverless = new serverless_1.default({ commands: [], options: {} });
            serverless.service.service = "test-service";
            var options = __assign({}, slsOpt);
            var provider = new provider_1.default(serverless);
            serverless.setProvider("aws", provider);
            serverless.cli = new cli_1.default(serverless);
            serverlessSnsSqsLambda = new serverless_sns_sqs_lambda_1.default(serverless, options);
        });
        describe("when no optional parameters are provided", function () {
            it("stage should default to 'dev'", function () {
                var template = {
                    Resources: __assign({}, generateIamLambdaExecutionRole())
                };
                var testConfig = {
                    name: "some-name",
                    topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic"
                };
                var validatedConfig = serverlessSnsSqsLambda.validateConfig("test-function", serverlessSnsSqsLambda.stage, testConfig);
                serverlessSnsSqsLambda.addEventQueue(template, validatedConfig);
                serverlessSnsSqsLambda.addEventDeadLetterQueue(template, validatedConfig);
                serverlessSnsSqsLambda.addEventSourceMapping(template, validatedConfig);
                serverlessSnsSqsLambda.addTopicSubscription(template, validatedConfig);
                serverlessSnsSqsLambda.addLambdaSqsPermissions(template, validatedConfig);
                expect(template).toMatchSnapshot();
            });
        });
        describe("when fifo is true", function () {
            it("stage should default to 'dev'", function () {
                var template = {
                    Resources: __assign({}, generateIamLambdaExecutionRole())
                };
                var testConfig = {
                    name: "some-name",
                    topicArn: "arn:aws:sns:us-east-2:123456789012:MyTopic",
                    fifo: true
                };
                var validatedConfig = serverlessSnsSqsLambda.validateConfig("test-function", serverlessSnsSqsLambda.stage, testConfig);
                serverlessSnsSqsLambda.addEventQueue(template, validatedConfig);
                serverlessSnsSqsLambda.addEventDeadLetterQueue(template, validatedConfig);
                serverlessSnsSqsLambda.addEventSourceMapping(template, validatedConfig);
                serverlessSnsSqsLambda.addTopicSubscription(template, validatedConfig);
                serverlessSnsSqsLambda.addLambdaSqsPermissions(template, validatedConfig);
                expect(template).toMatchSnapshot();
            });
        });
        describe("when there are duplicate names", function () {
            it("should throw", function () {
                var template = {
                    Resources: __assign({}, generateIamLambdaExecutionRole())
                };
                var testCase = {
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
                };
                var thunk = function () {
                    serverlessSnsSqsLambda.addSnsSqsResources(template, "Fn1", "unit-test", testCase.functions.Fn1.events[0].snsSqs);
                    serverlessSnsSqsLambda.addSnsSqsResources(template, "Fn2", "unit-test", testCase.functions.Fn2.events[0].snsSqs);
                };
                expect(thunk).toThrowErrorMatchingInlineSnapshot("\"Generated logical ID [Event1DeadLetterQueue] already exists in resources definition. Ensure that the snsSqs event definition has a unique name property.\"");
            });
        });
        describe("when the generated queue names are too long (over 80 characters)", function () {
            describe("when omitPhysicalId is false", function () {
                it("should throw", function () {
                    var template = {
                        Resources: __assign({}, generateIamLambdaExecutionRole())
                    };
                    var testCase = {
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
                    };
                    var thunk = function () {
                        serverlessSnsSqsLambda.addSnsSqsResources(template, "Fn1", "unit-test", testCase.functions.Fn1.events[0].snsSqs);
                    };
                    expect(thunk).toThrowErrorMatchingInlineSnapshot("\"Generated queue name [something-really-long-that-puts-it-over-80-characters-which-is-no-goodDeadLetterQueue] is longer than 80 characters long and may be truncated by AWS, causing naming collisions. Try a shorter prefix or name, or try the hashQueueName config option.\"");
                });
            });
        });
        describe("when omitPhysicalId is true", function () {
            it("should omit the queue name so that AWS can generate a unique one which is 80 chars or less", function () {
                var template = {
                    Resources: __assign({}, generateIamLambdaExecutionRole())
                };
                var testCase = {
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
                };
                serverlessSnsSqsLambda.addSnsSqsResources(template, "Fn1", "unit-test", testCase.functions.Fn1.events[0].snsSqs);
                var regularQueueName = template.Resources["over-80-characters-which-is-no-goodQueue"]
                    .Properties.QueueName;
                var deadLetterQueueName = template.Resources["over-80-characters-which-is-no-goodDeadLetterQueue"].Properties.QueueName;
                // AWS will do this for us
                expect(regularQueueName).toBeUndefined();
                expect(deadLetterQueueName).toBeUndefined();
            });
        });
    });
});
//# sourceMappingURL=serverless-sns-sqs-lambda.test.js.map