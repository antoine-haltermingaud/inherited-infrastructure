import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';

// Pricefeed needs MySQL for persistent data and Redis for derived/cached data.
export const DB_USER = 'admin';

export class DataStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly database: rds.DatabaseInstance;
  public readonly redisHost: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Keeping costs down: 2 AZs and a single NAT gateway.
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc: this.vpc,
      description: 'pricefeed mysql',
    });
    // MySQL is reachable from inside the VPC only. Team access from laptops
    // needs a tunnel from here on (SSM/VPN) — tracked in REVIEW.md.
    dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(3306),
      'mysql from vpc'
    );

    this.database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.MEDIUM
      ),
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      publiclyAccessible: true,
      securityGroups: [dbSecurityGroup],
      // Generated in Secrets Manager; deploying this rotates the master
      // password in place. Rollout order is in the commit message.
      credentials: rds.Credentials.fromGeneratedSecret(DB_USER),
      multiAz: false,
      allocatedStorage: 100,
      storageEncrypted: false,
      // Going 0 → 7 days initializes backups: brief outage on this single-AZ
      // instance. Deploy in a low-traffic window (REVIEW.md, Monday plan).
      backupRetention: cdk.Duration.days(7),
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
    });

    // Redis: derived data only, so a single small cache node is fine.
    const redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc: this.vpc,
      description: 'pricefeed redis',
    });
    redisSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(6379),
      'redis from vpc'
    );

    const redisSubnets = new elasticache.CfnSubnetGroup(this, 'RedisSubnets', {
      description: 'pricefeed redis subnets',
      subnetIds: this.vpc.privateSubnets.map((s) => s.subnetId),
    });

    const redis = new elasticache.CfnCacheCluster(this, 'Redis', {
      engine: 'redis',
      cacheNodeType: 'cache.t4g.micro',
      numCacheNodes: 1,
      cacheSubnetGroupName: redisSubnets.ref,
      vpcSecurityGroupIds: [redisSecurityGroup.securityGroupId],
    });
    redis.addDependency(redisSubnets);

    this.redisHost = redis.attrRedisEndpointAddress;
  }
}
