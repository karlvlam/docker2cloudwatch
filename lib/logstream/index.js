
class LogStream {
    constructor(o) {
        this.cwl = o['cwl'];
        this.group = o['group'];
        this.stream = o['stream'];
        this.token = null;

    }

    test(){
        console.log(this);
    }

    async pushLogs(mess){
        let opt = {
            logGroupName: this.group,
            logStreamName: this.stream,
            sequenceToken: this.token,
            logEvents: mess,
        }
        let cwl = this.cwl;
        try{
            let result = await cwl.putLogEvents(opt).promise();
            this.token = result['nextSequenceToken'];
            return result;
        }catch(err){

            console.log(JSON.stringify(err,null,2));
            if (
                err['code'] === 'DataAlreadyAcceptedException' || 
                err['code'] === 'InvalidSequenceTokenException'
            ) {
                console.log('TokenError');
                this.token = err['message'].split('The next expected sequenceToken is:')[1].trim();
                return await this.pushLogs(mess);

            }

            if ( err['code'] === 'ResourceNotFoundException') {
                console.log('ResourceNotFoundException');
                let r = null;
                try{
                    r = await cwl.createLogGroup({logGroupName: this.group}).promise();
                }catch(err){
                    if (err['code'] !== 'ResourceAlreadyExistsException'){
                        throw err;
                    }
                }

                try{
                    r = await cwl
                    .createLogStream({logGroupName: this.group, logStreamName: this.stream })
                    .promise();
                }catch(err){
                    if (err['code'] !== 'ResourceAlreadyExistsException'){
                        throw err;
                    }
                }

                return await this.pushLogs(mess);
            }

            throw err;
        }
    }


}


module.exports = LogStream;



