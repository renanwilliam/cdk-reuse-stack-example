import {Credentials} from "@aws-sdk/types";
import {CloudFormationDeployments} from "aws-cdk/lib/api/cloudformation-deployments";
import * as AWS from "aws-sdk";
import {App, Stack} from '@aws-cdk/core';
import {CloudFormationStackArtifact} from '@aws-cdk/cx-api';
import {DeployStackResult, SdkProvider} from "aws-cdk/lib";

export default class CdkDeployAbstraction {
    private readonly credentials: Credentials;
    private readonly region: string;

    constructor(config: { credentials?: Credentials; region: string }) {
        this.credentials = config.credentials;
        this.region = config.region;
    }

    public async deployCdkStack(app: App, stack: Stack, notificationTopicArn?: string): Promise<DeployStackResult> {
        const stackArtifact = app.synth().getStackByName(stack.stackName) as unknown as CloudFormationStackArtifact;
        const credentialProviderChain = new AWS.CredentialProviderChain();

        let credentials;
        if (this.credentials) {
            credentials = new AWS.Credentials({
                accessKeyId: this.credentials.accessKeyId,
                secretAccessKey: this.credentials.secretAccessKey,
            });

            credentialProviderChain.providers.push(credentials);
        }

        const sdkProvider = new SdkProvider(credentialProviderChain, this.region, {
            credentials: credentials,
        });

        const cloudFormation = new CloudFormationDeployments({sdkProvider});
        if (notificationTopicArn) {
            return cloudFormation.deployStack({
                // @ts-ignore
                stack: stackArtifact,
                notificationArns: [notificationTopicArn],
                quiet: true,
            });
        }
        return cloudFormation.deployStack({
            // @ts-ignore
            stack: stackArtifact,
            quiet: true,
        });
    }
}