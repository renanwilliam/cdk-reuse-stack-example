import * as AWS from 'aws-sdk';
import CdkDeployAbstraction from "./cdk/cdkDeployAbstraction";
import * as dotenv from "dotenv";
import {OtherStack} from "./cdk/OtherStack";
import {App} from "@aws-cdk/core";
import ReusableStackHandler from "./cdk/ReusableRootStack";

dotenv.config()

AWS.config.region = process.env.AWS_REGION;
AWS.config.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
};

(async (rootStackName: string) => {
    const reusableStackHandler = new ReusableStackHandler(rootStackName);

    const app = new App();
    const rootStack = await reusableStackHandler.getRootStack(app);
    new OtherStack(rootStack, 'OtherStack')

    const deploy = new CdkDeployAbstraction({
        region: process.env.AWS_REGION
    });

    const deployResult = await deploy.deployCdkStack(app, rootStack);
    console.log(deployResult);
})('MyAwesomeRootStackName')
    .then(value => console.log('finish!'))
    .catch(err => console.log(err))