import {Construct, NestedStack, NestedStackProps} from "@aws-cdk/core";
import * as iam from '@aws-cdk/aws-iam';

export class OtherStack extends NestedStack {
    constructor(scope: Construct, id: string, props?: NestedStackProps) {
        super(scope, id, props);

        new iam.ManagedPolicy(this, 'IamManagedPolicy', {
            managedPolicyName: 'TesteIAM-ManagedPolicy',
            document: new iam.PolicyDocument({
                statements: [
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: [
                            'dynamodb:GetItem',
                            'dynamodb:Query',
                        ],
                        resources: ['*']
                    })
                ]
            }),
        })
    }
}