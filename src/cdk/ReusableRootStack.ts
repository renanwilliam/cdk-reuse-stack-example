import * as AWS from "aws-sdk";
import fs from "fs";
import * as tmp from 'tmp';
import * as cfninc from "@aws-cdk/cloudformation-include";
import {CfnIncludeProps} from "@aws-cdk/cloudformation-include";
import {ReusableRootStackWithNestedStacks} from "./ReusableRootStackWithNestedStacks";
import {Construct} from "@aws-cdk/core";

export type CloudFormationDetails = {
    mainStack: {
        stack: AWS.CloudFormation.Stack,
        tmpFileName: any
    },
    nestedsStacksDetails: {
        [p: string]: CfnIncludeProps
    }
};

export default class ReusableRootStack {
    readonly stackName: string;

    constructor(stackName: string) {
        this.stackName = stackName;
    }

    async getRootStack(app: Construct) {
        const cloudformationDetails = await this.getStackDetails();
        return new ReusableRootStackWithNestedStacks(app,
            this.stackName,
            cloudformationDetails.mainStack.tmpFileName,
            cloudformationDetails.nestedsStacksDetails,
            cloudformationDetails.mainStack.stack
        );
    }

    protected async getNestedsStacks(stackName: string) {
        const cloudformation = new AWS.CloudFormation();
        const resourcesResult = await cloudformation.describeStackResources({
            StackName: stackName
        }).promise();

        const resources = resourcesResult.StackResources;
        const filteredResources = resources.filter(value => value.ResourceType === 'AWS::CloudFormation::Stack');

        let nestedStacks: { logicalResourceId: string, physicalResourceId: string; stack: AWS.CloudFormation.Stack }[] = [];
        for (let i = 0; i < filteredResources.length; i++) {
            const resource = filteredResources[i];

            const nestedStackResult = await cloudformation.describeStacks({
                StackName: resource.PhysicalResourceId
            }).promise();

            nestedStacks.push({
                logicalResourceId: resource.LogicalResourceId,
                physicalResourceId: resource.PhysicalResourceId,
                stack: nestedStackResult.Stacks.shift()
            });
        }

        return nestedStacks;
    }

    protected async getNestedsStackDetails(stackName: string) {
        const cloudformation = new AWS.CloudFormation();
        const currentNestedStacks = await this.getNestedsStacks(stackName);

        let nestedStacks: { [stackName: string]: cfninc.CfnIncludeProps; } = undefined;
        for (let i = 0; i < currentNestedStacks.length; i++) {
            const currentNestedStack = currentNestedStacks[i];

            const nestedStackResult = await cloudformation.describeStacks({
                StackName: currentNestedStack.stack.StackName
            }).promise();

            const nestedStack = nestedStackResult.Stacks.shift();
            const nestedStackTemplate = await cloudformation.getTemplate({
                StackName: nestedStack.StackName
            }).promise();

            const tmpFileName = tmp.tmpNameSync({
                postfix: '.yaml'
            });

            fs.writeFileSync(tmpFileName, nestedStackTemplate.TemplateBody);

            if (!nestedStacks) {
                nestedStacks = {};
            }
            const recursiveNestedStacks = await this.getNestedsStackDetails(nestedStack.StackName);
            nestedStacks[currentNestedStack.logicalResourceId] = {
                templateFile: tmpFileName,
                parameters: nestedStack.Parameters.reduce((previousValue, currentValue) => {
                    previousValue[currentValue.ParameterKey] = currentValue.ParameterValue;
                    return previousValue;
                }, {}),
                loadNestedStacks: recursiveNestedStacks
            }
        }

        return nestedStacks;
    }

    private async getStackDetails(): Promise<CloudFormationDetails> {
        const cloudformation = new AWS.CloudFormation();
        const stacksResult = await cloudformation.describeStacks({
            StackName: this.stackName,
        }).promise();

        const stack = stacksResult.Stacks.shift();
        const stackTemplate = await cloudformation.getTemplate({
            StackName: stack.StackName,
        }).promise();

        const tmpFileName = tmp.tmpNameSync({
            postfix: '.yaml'
        });
        fs.writeFileSync(tmpFileName, stackTemplate.TemplateBody);

        const nestedsStacksDetails = await this.getNestedsStackDetails(stack.StackName)

        return {
            mainStack: {
                stack,
                tmpFileName
            },
            nestedsStacksDetails
        }
    }
}