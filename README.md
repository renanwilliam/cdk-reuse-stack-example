## Example for reuse of root stack created using AWS CDK in another apps

#### See more details at [my StackOverflow qustion](https://stackoverflow.com/questions/72230582/reuse-a-parent-cdk-stack-in-other-app-project/72230879?noredirect=1#comment127622565_72230879)

First at all, it's important mention that I'm not using CDK as usual. Instead, I'm creating resources on-the-fly
programatically. So, basically, I have a multi-tenant application that on onboard it's created a customer root stack,
that will be included nested stacks with resources during the customer lifetime.

I have read this [documentation](https://docs.aws.amazon.com/cdk/v2/guide/resources.html#resources_importing) but can't
figure out how do that. I need to referente a parent existing stack (created by other app, in other moment, in other
code base) to a new NestedStack.

This repository have the solution for my problem, reading CloudFormation templates using AWS SDK and mixing with CDK
classes.

