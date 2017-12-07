# docker2cloudwatch
log shipper from docker to cloudwatch

# Dependencies
 - Node.js 8.9.0 or above
 - dockerode


# How to run
1. set LOG__UNIQUE_ID as LogGroup name prefix
2. run the script


## Example
```bash
export LOG_UNIQIE_ID='myloggroup'
node docker2cloudwatch
```
