import * as fs from "fs";
import * as AWS from 'aws-sdk';
import * as cfninc from '@aws-cdk/cloudformation-include';
import * as tmp from 'tmp';
import CdkDeployAbstraction from "./cdk/cdkDeployAbstraction";
import * as dotenv from "dotenv";
import {ReusableRootStackWithNestedStacks} from './cdk/ReusableRootStackWithNestedStacks';
import {OtherStack} from "./cdk/OtherStack";
import {App} from "@aws-cdk/core";

dotenv.config()

AWS.config.region = process.env.AWS_REGION;
AWS.config.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
};

const getNestedsStacks = async (stackName: string) => {
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

const getNestedsStackDetails = async (stackName: string) => {
    const cloudformation = new AWS.CloudFormation();
    const currentNestedStacks = await getNestedsStacks(stackName);

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
        const recursiveNestedStacks = await getNestedsStackDetails(nestedStack.StackName);
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

const getStackDetails = async (stackName: string) => {
    const cloudformation = new AWS.CloudFormation();
    const stacksResult = await cloudformation.describeStacks({
        StackName: stackName,
    }).promise();

    const stack = stacksResult.Stacks.shift();
    const stackTemplate = await cloudformation.getTemplate({
        StackName: stack.StackName,
    }).promise();

    const tmpFileName = tmp.tmpNameSync({
        postfix: '.yaml'
    });
    fs.writeFileSync(tmpFileName, stackTemplate.TemplateBody);

    const nestedsStacksDetails = await getNestedsStackDetails(stack.StackName)

    return {
        mainStack: {
            stack,
            tmpFileName
        },
        nestedsStacksDetails
    }
}

const main = async (rootStackName: string) => {
    const stackName = rootStackName;
    const stackDetails = await getStackDetails(stackName);

    const app = new App();
    const rootStack = new ReusableRootStackWithNestedStacks(app,
        stackName,
        stackDetails.mainStack.tmpFileName,
        stackDetails.nestedsStacksDetails,
        stackDetails.mainStack.stack
    );
    new OtherStack(rootStack, 'OtherStack')

    const deploy = new CdkDeployAbstraction({
        region: process.env.AWS_REGION
    });

    const deployResult = await deploy.deployCdkStack(app, rootStack);
    console.log(deployResult);
}

main('MyAwesomeRootStackName')
    .then(value => console.log('finish!'))
    .catch(err => console.log(err))