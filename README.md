# docker2cloudwatch
log shipper from docker to cloudwatch

# Dependencies
 - Node.js 8.9.0 or above
 - dockerode


# How to run
1. set LOG_GROUP as LogGroup name 
2. set AWS_ACCESS_KEY_ID,AWS_SECRET_ACCESS_KEY for AWS access
3. run the script


## Example
```bash
export AWS_ACCESS_KEY_ID=aws-access-key-id
export AWS_SECRET_ACCESS_KEY=aws-secret-access-key
export LOG_REGION=ap-northeast-1
export LOG_GROUP='myloggroup'
node docker2cloudwatch
```
## Docker

1. mount host docker socket file to  /var/run/docker.sock
