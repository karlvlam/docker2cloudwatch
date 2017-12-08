/* 
 * use node 8.9.0 or above
*/ 

process.on('unhandledRejection', function(reason, p) {
    log("Unhandled Rejection at: Promise ", p, " reason: ", reason);
});

const ENV = process.env;

const DEBUG = ENV['DEBUG'] || false; 
const SEC = 1000;
const LOG_FLUSH_TIME = SEC * 5;
const LOG_LOCK_TIME = SEC * 60;
const LOG_BATCH_SIZE = 500;

const METRIC_FLUSH_TIME = SEC * 5;
const METRIC_UPDATE_TIME = SEC * 60;

const LOG_UNIQUE_ID= ENV['LOG_UNIQUE_ID'] || 'LOG_UNIQUE_ID';
const LOG_REGION= ENV['LOG_REGION'] || null;

const AWS = require('aws-sdk');
const Docker = require('./lib/docker');
const LogStream = require('./lib/logstream');
const util = require('./lib/util');
const metric = require('./lib/metric');

let theCwl = new AWS.CloudWatchLogs({ region:LOG_REGION });
function log(message){
    console.log('[' + new Date().toISOString() + '] ' + message);
}

function debug(message){
    if (DEBUG){
        log(message);
    }
}


let opt = {
    logCallBack: logCallBack,
    containerEvtCallBack: containerEvtCallBack,
}



let docker = new Docker(opt);


let logPool = {};
let metricList = [];

async function newLogPool(id){
    let c = await docker.getContainer(id); 
    // TODO: make logGroup/logStream name  configurable
    let format = util.getLogFormat(util.getK8sFormat(LOG_UNIQUE_ID), c['Labels']);
    let group = format['group'];
    let stream = format['stream'];
    let opt = {
        cwl: theCwl,
        group: group,
        stream: stream,
    }
    let ls = new LogStream(opt);

    let obj = {
        lock: null, 
        logStream: ls, 
        mess: [],
    }

    return obj;
}

async function flushLog(lp){
    if (lp.lock && (lp.lock + LOG_LOCK_TIME) > new Date().getTime()){ 
        return; 
    }
    lp.lock = new Date().getTime();

    while (lp.mess.length !== 0) {
        let logs = lp.mess.splice(0,LOG_BATCH_SIZE).map(function(o){
            return {
                timestamp: o['timestamp'],
                message: o['message'],
            };
        });
        debug(JSON.stringify(logs));
        try{
            await lp.logStream.pushLogs(logs);
        }catch(err){
            log(err);
        }
    }

    lp.lock = null;

}



function _showLogPool(){

    Object.keys(logPool).map(function(o){
        console.log(o + ': ' + logPool[o].length);
    });
}

//setInterval(_showLogPool, 3000);
//_showLogPool();

async function logCallBack(o) {
    let id = o['info']['id'];
    let lp = logPool[id] || null;
    if (!lp) {
        lp = await newLogPool(id);
        logPool[id] = lp;
        log('[LOG_STORE] create log: ' + id)
    }
    await lp.mess.push(o);

    debug('push ok');
}

async function containerEvtCallBack(o) {
    debug('=== Container evt: ' + JSON.stringify(o));

    if (o['type'] === 'start'){
        let id = o['id'];
        log('[LOG] create log at start: ' + id);
        let lp = await newLogPool(id);
        logPool[id] = lp;
        return;
    }

    if (o['type'] === 'close'){
        debug('=== delete')
        let id = o['id'];
        setTimeout(removeLog, 10000, id)
        return;
    }


}

function removeLog(id){
    log('remove log:' + id);
    delete logPool[id];
}


async function metricCallBack(o) {
    log(JSON.stringify(o,null,2));
}


async function main(){
    log(JSON.stringify(await docker.getContainers()));
}

main();

setInterval(metric.logDockerStats, 5000, docker, metricCallBack);


setInterval(function(){
    Object.keys(logPool).map(function(id){
        flushLog(logPool[id]);
    });
}, LOG_FLUSH_TIME);


// run GC every 10 min 
setInterval(function(){
    if (global.gc){
        global.gc();
        log("[GC] Done!");
        return;
    }
    log("[GC] no GC, run with --expose-gc ?");

}, 600000);

