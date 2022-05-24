# Changelog

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.0.1](https://github.com/agiledigital/serverless-sns-sqs-lambda/compare/v2.0.0...v2.0.1) (2022-05-24)


### Bug Fixes

* add 'prefix' to config schema (fixes [#562](https://github.com/agiledigital/serverless-sns-sqs-lambda/issues/562)) ([4602a63](https://github.com/agiledigital/serverless-sns-sqs-lambda/commit/4602a63e5b6e726f8931f3c3a3239117d25fe266))

# [2.0.0](https://github.com/agiledigital/serverless-sns-sqs-lambda/compare/v1.0.1...v2.0.0) (2022-05-13)


### Bug Fixes

* fix case sensitivity issue ([42e9675](https://github.com/agiledigital/serverless-sns-sqs-lambda/commit/42e967520705b0d36fbf8b7b8030d40985e34a3b))
* improve the handling of encrypted SQS queues (fixes [#555](https://github.com/agiledigital/serverless-sns-sqs-lambda/issues/555)) ([789ea78](https://github.com/agiledigital/serverless-sns-sqs-lambda/commit/789ea786e599aefd8df8d51f4cf8ca70f74810a4))


### Features

* upgrade to serverless v3 ([#540](https://github.com/agiledigital/serverless-sns-sqs-lambda/issues/540)) ([cf842f0](https://github.com/agiledigital/serverless-sns-sqs-lambda/commit/cf842f0b461594ea03df0dfee3ff7909d6e2c04b))


### BREAKING CHANGES

* If you have implemented workarounds to allow the lambda to subscribe to an encrypted SQS queue, you may get conflicts as the policy to allow the decryption is now added automatically

- If you provide an key ID, key ARN or reference to a key ARN to the `kmsMasterKeyId` attribute, the relevant 'kms:Decrypt' policy statement should be added automatically to allow the subscription to work correctly
* serverless v2 is no longer supported. It might still work, but bug fixes/new features will mostly be developed for and tested with serverless v3 (important security/bug fixes _may_ be back ported to v2 versions depending on the uptake of v3)

serverless v3 is now a peer dependency, you will get warnings if you are on earlier versions

## [1.0.1](https://github.com/agiledigital/serverless-sns-sqs-lambda/compare/v1.0.0...v1.0.1) (2022-05-13)


### Bug Fixes

* allow physical ID to be omitted ([#444](https://github.com/agiledigital/serverless-sns-sqs-lambda/issues/444)) ([b22944f](https://github.com/agiledigital/serverless-sns-sqs-lambda/commit/b22944f5094a544fe7b4f1b0358d21967668b6e2))
* ensure name uniqueness ([#444](https://github.com/agiledigital/serverless-sns-sqs-lambda/issues/444)) ([83617d6](https://github.com/agiledigital/serverless-sns-sqs-lambda/commit/83617d6b98164cf14b14944a3a94e9dec906267e))

# [1.0.0](https://github.com/agiledigital/serverless-sns-sqs-lambda/compare/v0.9.1...v1.0.0) (2022-01-07)


### Bug Fixes

* add another source of stage ([e9c1cb1](https://github.com/agiledigital/serverless-sns-sqs-lambda/commit/e9c1cb185706dca8ffcaf8b5b1a82b80512215c1)), closes [#432](https://github.com/agiledigital/serverless-sns-sqs-lambda/issues/432)


### Features

* ensure that work done for issue [#432](https://github.com/agiledigital/serverless-sns-sqs-lambda/issues/432) is published as a new major version ([6433354](https://github.com/agiledigital/serverless-sns-sqs-lambda/commit/643335489b6488d8beb4ed2755c60623b16cabe1))


### BREAKING CHANGES

* the way that stage is determined has changed which might cause the generated CF template to change, causing issues on the next deploy

## [0.9.1](https://github.com/agiledigital/serverless-sns-sqs-lambda/compare/v0.9.0...v0.9.1) (2021-10-23)


### Bug Fixes

* remove unneccessary 'DependsOn' block ([9276523](https://github.com/agiledigital/serverless-sns-sqs-lambda/commit/9276523d01cb510b6fd2f685f121b1c42a86a77e))
* support custom role ARNs ([563c202](https://github.com/agiledigital/serverless-sns-sqs-lambda/commit/563c20267151efa7122e8a3f7a5df0ea49a25c37)), closes [#350](https://github.com/agiledigital/serverless-sns-sqs-lambda/issues/350)

# [0.9.0](https://github.com/agiledigital/serverless-sns-sqs-lambda/compare/v0.8.0...v0.9.0) (2021-10-13)


### Features

* add fifo queue support ([b1122b0](https://github.com/agiledigital/serverless-sns-sqs-lambda/commit/b1122b0bc01da6c0e84a3f83892017e37c9d88f3))

# [0.8.0](https://github.com/agiledigital/serverless-sns-sqs-lambda/compare/v0.7.0...v0.8.0) (2021-06-29)


### Features

* make queue policy more specific ([6ac0c96](https://github.com/agiledigital/serverless-sns-sqs-lambda/commit/6ac0c9689765205fd6a36c48949ed34d6e0f63ec))

# [0.7.0](https://github.com/agiledigital/serverless-sns-sqs-lambda/compare/v0.6.0...v0.7.0) (2021-06-09)


### Features

* add config validation schema ([a16e1ee](https://github.com/agiledigital/serverless-sns-sqs-lambda/commit/a16e1ee9b40957faf85c3d60e2bd2439e9b9be40)), closes [#58](https://github.com/agiledigital/serverless-sns-sqs-lambda/issues/58)

# [0.6.0](https://github.com/agiledigital/serverless-sns-sqs-lambda/compare/v0.5.0...v0.6.0) (2021-05-14)


### Features

* allow CloudFormation overrides ([6d80b18](https://github.com/agiledigital/serverless-sns-sqs-lambda/commit/6d80b18adb6b13a5624177c619f3c6d251da6aea)), closes [#213](https://github.com/agiledigital/serverless-sns-sqs-lambda/issues/213)

# [0.5.0](https://github.com/agiledigital/serverless-sns-sqs-lambda/compare/v0.4.0...v0.5.0) (2021-04-29)


### Features

* pass through batching window parameter ([83e2922](https://github.com/agiledigital/serverless-sns-sqs-lambda/commit/83e29228e70b351a1e42236a5d7ac32891a01543))

# [0.4.0](https://github.com/agiledigital/serverless-sns-sqs-lambda/compare/v0.3.0...v0.4.0) (2021-04-15)


### Features

* force release ([26d4e46](https://github.com/agiledigital/serverless-sns-sqs-lambda/commit/26d4e46e50a9c13d5a79326fd88d46d9d883023e))

# [0.3.0](https://github.com/agiledigital/serverless-sns-sqs-lambda/compare/v0.2.1...v0.3.0) (2021-03-04)


### Features

* add `deadLetterMessageRetentionPeriodSeconds` option ([89a17b8](https://github.com/agiledigital/serverless-sns-sqs-lambda/commit/89a17b829c48f66574efcaeea478193a6954ac53))

## [0.2.1](https://github.com/agiledigital/serverless-sns-sqs-lambda/compare/v0.2.0...v0.2.1) (2021-01-20)


### Bug Fixes

* Fix import of AWS provider class in test ([acd748f](https://github.com/agiledigital/serverless-sns-sqs-lambda/commit/acd748ff7ac5fff87ba9f76d4631d8c2869117af))

# [0.2.0](https://github.com/agiledigital/serverless-sns-sqs-lambda/compare/v0.1.12...v0.2.0) (2020-11-03)


### Features

* force release ([fca8a5a](https://github.com/agiledigital/serverless-sns-sqs-lambda/commit/fca8a5adde9e595c6f99f8e088ac01fad98dbb33))

## [0.1.12](https://github.com/agiledigital/serverless-sns-sqs-lambda/compare/v0.1.11...v0.1.12) (2020-09-11)


### Bug Fixes

* Use raw ARN to avoid cyclic dependency ([f16ab09](https://github.com/agiledigital/serverless-sns-sqs-lambda/commit/f16ab09fa5872c804cd8ea64771e3cd27ca51865))

## [0.1.11](https://github.com/agiledigital/serverless-sns-sqs-lambda/compare/v0.1.10...v0.1.11) (2020-08-11)


### Bug Fixes

* don't include cruft in release tarball ([6243ba1](https://github.com/agiledigital/serverless-sns-sqs-lambda/commit/6243ba10b22b038748516d08b875ba654f9a814e))

## [0.1.10](https://github.com/agiledigital/serverless-sns-sqs-lambda/compare/v0.1.9...v0.1.10) (2020-08-11)


### Bug Fixes

* add badges to README ([0d2549e](https://github.com/agiledigital/serverless-sns-sqs-lambda/commit/0d2549e5f7bf28c20c83089b64914a72b901d035))
* make style more consistent ([d6248ea](https://github.com/agiledigital/serverless-sns-sqs-lambda/commit/d6248ea2b38a22fd28b956c1b73e6fba4345170d))

# 0.0.\*

First Release and other initial work
