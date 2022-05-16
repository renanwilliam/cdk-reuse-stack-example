import * as AWS from 'aws-sdk';
import {Construct, Stack, StackProps} from "@aws-cdk/core";
import * as cfninc from '@aws-cdk/cloudformation-include';

export class ReusableRootStackWithNestedStacks extends Stack {
    constructor(scope: Construct, id: string, tmpFileName: string, nestedStacks: { [stackName: string]: cfninc.CfnIncludeProps; }, stack: AWS.CloudFormation.Stack, props?: StackProps) {
        super(scope, id, props);

        new cfninc.CfnInclude(this, 'CfCurrentTemplate', {
            templateFile: tmpFileName,
            loadNestedStacks: nestedStacks,
            parameters: stack.Parameters.reduce((previousValue, currentValue) => {
                previousValue[currentValue.ParameterKey] = currentValue.ParameterValue;
                return previousValue;
            }, {})
        });
    }
}