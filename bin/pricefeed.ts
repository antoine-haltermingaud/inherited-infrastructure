#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DataStack } from '../lib/data-stack';
import { ServiceStack } from '../lib/service-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'eu-west-1',
};

const data = new DataStack(app, 'PricefeedData', { env });

new ServiceStack(app, 'PricefeedService', {
  env,
  vpc: data.vpc,
  database: data.database,
  redisHost: data.redisHost,
});
