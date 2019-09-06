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

    Object.keys(functions).forEach(funcKey => {
      const func = functions[funcKey];
      if (func.events) {
        func.events.forEach(event => {
          if (event.snsSqs) {
            console.log(`${funcKey} has an snsSqsEvent`);
            console.dir(event.snsSqs, { depth: null });
          }
        });
      }
    });
    process.exit(1);
  }
};
