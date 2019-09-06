"use strict";

module.exports = class LambdaEdge {
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
    const template = this.serverless.service.provider
      .compiledCloudFormationTemplate;

    console.dir(template, { depth: null });
  }
};
