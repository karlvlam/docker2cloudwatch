
function getK8sFormat(baseString) {
    return {
        base: baseString,
        group: {
            others: baseString + '/' + 'others',
            format: ['io.kubernetes.pod.namespace'],
        },
        stream: {
            others: 'others',
            format: ['io.kubernetes.pod.name','io.kubernetes.container.name'],
        }
    }
}

function getLogFormat(format, labels){
    let group = format['group']['others'];
    let stream = format['stream']['others'];

    let t = format['group']['format'].map(function(o){
        return labels[o];
    }).filter(function(o){
        return o;
    });
    if (t.length === format['group']['format'].length) {
        group = format['base'] + '/' + t.join('/');
    }

    t = format['stream']['format'].map(function(o){
        return labels[o];
    }).filter(function(o){
        return o;
    });
    if (t.length === format['stream']['format'].length) {
        stream = t.join('/');
    }

    return { group: group, stream: stream};

}


module.exports = {
    getK8sFormat: getK8sFormat,
    getLogFormat: getLogFormat,
    
}

