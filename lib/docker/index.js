
const Dockerode = require('dockerode');
const format = require('../format');
const stream = require('stream');

function log(message){
    console.log('[' + new Date().toISOString() + '] ' + message);
}

/*
 * 
 * Change docker log buffer to json object:
 * {
 * 
 *     type: 'docker-log',
 *     timestamp: "unix time in ISO String",
 *     message: "log content",
 * }
 * 
 * */
function dockerLogToObj(chunk){
    try{
        let s = chunk.toString();
        let r = { 
            //"@marker": CUSTOM_FIELD,
            //"@type": 'docker-log',
            timestamp: new Date(s.substr(0, 30)).getTime(),
            message: s.substr(31).trim()
        }
        return r;
    }catch(err){
        log('dokerLogToObj: ' + err)
    }
}


class Docker {
    constructor(p){
        let o = p || {};

        this.debug = o['debug'] || false;
        this.logCallBack = o['logCallBack'] || function(){};
        this.containerEvtCallBack = o['containerEvtCallBack'] || function(){};

        this.docker = new Dockerode({socketPath: '/var/run/docker.sock'}); // unix socket
        this.dockerEvtSocket = null; // docker event listener socket
        this.containerPool = {}; // keep a connection pool of docker api
        this.init();
    }

    init(){
        log('Start listening Docker events/logs...');
        this.logContainers();
        this.listenDockerEvent();
    }

    async getContainer(id){
        let docker = this.docker;
        let c = null;
        try{
           let list =  await docker.listContainers({});
           c = list.find(function(o){
               return o['Id'] === id;
           });

        }catch(err){
            log(err);
        }
        return c;
    }

    async getStats(){
        let docker = this.docker;
        let containers = await docker.listContainers();
        // do with async
        try{
            let stats = await Promise.all(containers.map(async function(c){
                try{
                    let id = c.Id;
                    let labels = c['Labels'];
                    let a = await docker.getContainer(id);
                    let s = await a.stats({stream:false});
                    return {id:id,labels: labels, stats:s};
                }catch(e){
                    log(e);
                }
            }));
            return stats;
        }catch(e){
            log(e);
        }
        return [];
    }

    async getContainers(){
        let docker = this.docker;
        try {
            var res = await docker.listContainers({});
        }catch(err){
            log(err)
            return []
        }
        return res;
    }

    async logContainers(id, since){
        // get all containers
        let me = this;
        let containers = await this.getContainers();
        containers.map(function(c){

            if (id && since && c['Id'] === id){
                me._logContainer(c, since);
            }
            me._logContainer(c);
        });

    };

    _logContainer(c, since){
        // stop if already exist in connection pool
        let containerPool = this.containerPool;
        if (containerPool[c.Id]){
            return;
        }

        //var labels = format.getLabel({}, c['Labels']);

        this.listenDockerLog({id: c.Id, since: since});

    }

    cleanPool(id){
        delete this.containerPool[id]; // remove socket object from the pool
        this.containerEvtCallBack({type:'close' ,id:id});
        //delete statsPool[id];
    }

    listenDockerLog(info){
        // stop if exists
        let me = this;
        let containerPool = this.containerPool;
        let docker = this.docker;
        if (containerPool[info.id]){
            return;
        }

        let container = docker.getContainer(info.id);
        let logStream = new stream.PassThrough();
        let logCallBack = this.logCallBack;
        containerPool[info.id] = logStream; // store socket object to the pool
        logStream.info = info; // store info for reference
        // TODO: may also need to close the "stream" ?
        logStream.on('data', function(chunk){
            let l = dockerLogToObj(chunk); 
            // add the Labels to the real log object
            try{
                // fire the log!
                l['info'] = info;
                logCallBack(l);
            }catch(err){
                log('LOG_ERROR: ' + err);
            }
        });

        logStream.on('end', function(){
            log('LogSteam ended! ' + logStream.info.id);
        })
        logStream.on('error', function(){
            log('LogSteam error! ' + logStream.info.id);
        })

        logStream.on('close', function(){
            log('LogSteam closed! ' + logStream.info.id);
        })

        if (!info['since']){
            info['since'] = Math.floor(new Date().getTime()/1000) - 1; 
        }

        container.logs({
            follow: true,
            stdout: true,
            stderr: true,
            timestamps: true,
            // unixtime in SEC, very on99!
            since: info['since'], 
        }, function(err, stream){
            if(err) {
                log(err);
                return;
            }

            container.modem.demuxStream(stream, logStream, logStream);
            log('Container log stream connected! ' + logStream.info.id);

            stream.on('error', function(err){
                log('Container stream error! ' + logStream.info.id);
                log(err);
            });

            stream.on('end', function(){
                log('Container stream ended! "' + logStream.info.id );
                me.cleanPool(logStream.info.id);
                logStream.end('!stop!');
            });

            stream.on('close', function(){
                log('Container stream closed! "' + logStream.info.id );
                log('Container "' + logStream.info.id +'" stopped!');
                me.cleanPool(logStream.info.id);
                logStream.end('!stop!');
            });

        });
    }





    /* Docker events sample
    {
        "status": "start",
        "id": "451368a754f26702c12dbc44cfc7ac7096f775c57415522bb57005b0881de834",
        "from": "quay.io/onesky/dummy-log",
        "Type": "container",
        "Action": "start",
        "Actor": {
            "ID": "451368a754f26702c12dbc44cfc7ac7096f775c57415522bb57005b0881de834",
            "Attributes": {
                "image": "quay.io/onesky/dummy-log",
                "name": "optimistic_spence"
            }
        },
        "time": 1489729976,
        "timeNano": 1489729976229354000
    }


    {
        "status": "die",
        "id": "9c84c4fba102a75ad1e501b78fa80338e32fc39d356d7421f23e49d80cc0212b",
        "from": "quay.io/onesky/dummy-log",
        "Type": "container",
        "Action": "die",
        "Actor": {
            "ID": "9c84c4fba102a75ad1e501b78fa80338e32fc39d356d7421f23e49d80cc0212b",
            "Attributes": {
                "exitCode": "0",
                "image": "quay.io/onesky/dummy-log",
                "name": "nervous_northcutt"
            }
        },
        "time": 1489730101,
        "timeNano": 1489730101166362600
    }

    */

    listenDockerEvent(){
        let docker = this.docker;
        let dockerEvtSocket = this.dockerEvtSocket;
        let me = this;
        try{
            if (dockerEvtSocket.ready) {
                return;
            }
        }catch(err){}

        docker.getEvents({},function(err, res){
            if (err){
                console.log(err);
                return;
            }
            dockerEvtSocket = res;
            dockerEvtSocket.ready = true;
            res.on('data', function(data){

                var event = JSON.parse(data.toString());
                /* 
                 * Only 2 events will be considered:
                 * 1. container -> start (just log that container)
                 * 2. container -> die (log only)
                 */
                if (event['Type'] !== 'container') {
                    return;
                }

                if (event['status'] === 'start') {
                    log('[DOCKER_EVENT] ' + event['id']  + ' '+  event['status'] );
                    me.containerEvtCallBack({type:'start', id: event['id']})
                    me.logContainers(event['id'], event['time']);
                    return;
                }

                if (event['status'] === 'die') {
                    log('[DOCKER_EVENT] ' + event['id']  + ' '+  event['status'] );
                    return;
                }
            })

            res.on('error', function(){
                log('[ERROR] Listen Docker Event error.');

            })
            res.on('end', function(){
                log('[ERROR] Listen Docker Event connection end.');
                dockerEvtSocket = null;
                listenDockerEvent();
            })
            res.on('close', function(){
                log('[ERROR] Listen Docker Event connection closed.');
                dockerEvtSocket = null;
                listenDockerEvent();
            })

            log('Listening Docker Events...');
        })

    }


}


module.exports = Docker;


