import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import { DB_USER } from './data-stack';

interface ServiceStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  database: rds.DatabaseInstance;
  redisHost: string;
}

export class ServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);

    const cluster = new ecs.Cluster(this, 'Cluster', { vpc: props.vpc });

    const repository = new ecr.Repository(this, 'Repository', {
      repositoryName: 'pricefeed',
    });

    // Keep all logs forever — you never know when you'll need them.
    const logGroup = new logs.LogGroup(this, 'Logs', {
      logGroupName: '/pricefeed/app',
      retention: logs.RetentionDays.INFINITE,
    });

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      cpu: 512,
      memoryLimitMiB: 1024,
    });

    // The task occasionally needs to touch other AWS services (S3 exports,
    // parameter store, ...) — easiest to just grant access broadly.
    taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['*'],
        resources: ['*'],
      })
    );

    taskDefinition.addContainer('app', {
      image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
      portMappings: [{ containerPort: 3000 }],
      logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: 'pricefeed' }),
      environment: {
        PORT: '3000',
        DB_HOST: props.database.dbInstanceEndpointAddress,
        DB_USER,
        REDIS_HOST: props.redisHost,
      },
      // Injected by ECS at start-up straight from Secrets Manager — the
      // password no longer appears in the task definition or the console.
      secrets: {
        DB_PASSWORD: ecs.Secret.fromSecretsManager(
          props.database.secret!,
          'password'
        ),
      },
    });

    const service = new ecs.FargateService(this, 'Service', {
      cluster,
      taskDefinition,
      desiredCount: 2,
      // Keep the old tasks serving until replacements pass health checks.
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      // Roll back automatically instead of hanging for hours on a bad image.
      circuitBreaker: { rollback: true },
    });

    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc: props.vpc,
      internetFacing: true,
    });

    const listener = alb.addListener('Http', { port: 80, open: true });

    listener.addTargets('App', {
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      healthCheck: { path: '/health' },
    });

    new cdk.CfnOutput(this, 'Url', {
      value: `http://${alb.loadBalancerDnsName}`,
    });
  }
}
