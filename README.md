# docker2cloudwatch
log shipper from docker to cloudwatch

# Dependencies
 - Node.js 8.9.0 or above
 - dockerode


# How to run
1. set LOG__UNIQUE_ID as LogGroup name prefix
1. set AWS_ACCESS_KEY_ID,AWS_SECRET_ACCESS_KEY as LogGroup name prefix
2. run the script


## Example
```bash
export AWS_ACCESS_KEY_ID=aws-access-key-id
export AWS_SECRET_ACCESS_KEY=aws-secret-access-key
export LOG_REGION=ap-northeast-1
export LOG_UNIQIE_ID='myloggroup'
node docker2cloudwatch
```
